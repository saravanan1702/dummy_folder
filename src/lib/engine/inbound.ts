import type { Channel } from "@/generated/prisma/client";
import { planOf } from "@/config/plans";
import { db } from "../db";
import type { InboundEvent } from "../channels";
import { decodePostback } from "../flow/types";
import { continueFromHandle, feedInput, startFlow } from "./runner";

export interface InboundResult {
  contactId: string;
  conversationId: string;
  /** True when a flow reacted to the message. */
  automated: boolean;
  duplicate?: boolean;
}

interface KeywordConfig {
  keywords?: string[];
  match?: "contains" | "exact" | "starts_with";
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordMatches(text: string, config: KeywordConfig): boolean {
  const body = normalize(text);
  if (!body) return false;
  const match = config.match ?? "contains";
  for (const raw of config.keywords ?? []) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (match === "exact" && body === kw) return true;
    if (match === "starts_with" && body.startsWith(kw)) return true;
    if (match === "contains") {
      // Whole-word match for latin keywords; plain substring for everything else.
      const wordy = /^[\w\s]+$/.test(kw);
      if (wordy ? new RegExp(`(^|\\W)${escapeRegExp(kw)}($|\\W)`).test(body) : body.includes(kw)) return true;
    }
  }
  return false;
}

const MATCH_RANK = { exact: 0, starts_with: 1, contains: 2 } as const;

async function findKeywordFlow(workspaceId: string, text: string): Promise<string | null> {
  const triggers = await db.trigger.findMany({
    where: { workspaceId, type: "KEYWORD", enabled: true, flow: { status: "PUBLISHED" } },
    orderBy: { createdAt: "asc" },
  });
  const hits = triggers
    .filter((t) => keywordMatches(text, t.config as KeywordConfig))
    .sort(
      (a, b) =>
        MATCH_RANK[(a.config as KeywordConfig).match ?? "contains"] -
        MATCH_RANK[(b.config as KeywordConfig).match ?? "contains"],
    );
  return hits[0]?.flowId ?? null;
}

async function findTriggerFlow(workspaceId: string, type: "WELCOME" | "DEFAULT_REPLY") {
  return db.trigger.findFirst({
    where: { workspaceId, type, enabled: true, flow: { status: "PUBLISHED" } },
    orderBy: { createdAt: "asc" },
  });
}

async function findRefFlow(workspaceId: string, ref: string): Promise<string | null> {
  if (!ref) return null;
  const triggers = await db.trigger.findMany({
    where: { workspaceId, type: "REF_LINK", enabled: true, flow: { status: "PUBLISHED" } },
  });
  return triggers.find((t) => (t.config as { ref?: string }).ref === ref)?.flowId ?? null;
}

/**
 * Entry point for every message a contact sends on any channel:
 * records it, then lets automation react (question → keyword → welcome → default reply).
 */
export async function handleInbound(channel: Channel, event: InboundEvent): Promise<InboundResult> {
  const workspaceId = channel.workspaceId;
  const now = new Date();
  const profile = event.profile ?? {};

  // ── Contact ──
  const existing = await db.contact.findUnique({
    where: { channelId_externalId: { channelId: channel.id, externalId: event.externalUserId } },
  });
  const isNew = !existing;
  const contact = existing
    ? await db.contact.update({
        where: { id: existing.id },
        data: {
          lastInboundAt: now,
          // Fill in profile details we did not have yet; never overwrite edits made in the dashboard.
          firstName: existing.firstName ?? profile.firstName ?? undefined,
          lastName: existing.lastName ?? profile.lastName ?? undefined,
          username: profile.username ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined,
          phone: existing.phone ?? profile.phone ?? undefined,
          locale: existing.locale ?? profile.locale ?? undefined,
        },
      })
    : await db.contact
        .create({
          data: {
            workspaceId,
            channelId: channel.id,
            externalId: event.externalUserId,
            firstName: profile.firstName ?? null,
            lastName: profile.lastName ?? null,
            username: profile.username ?? null,
            phone: profile.phone ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            locale: profile.locale ?? null,
            source: event.kind === "ref" && event.ref ? `ref:${event.ref}`.slice(0, 100) : channel.type.toLowerCase(),
            lastInboundAt: now,
          },
        })
        .catch(async (err: { code?: string }) => {
          // Two webhooks for a brand-new contact raced; use the row the other one created.
          if (err.code !== "P2002") throw err;
          return db.contact.findUniqueOrThrow({
            where: { channelId_externalId: { channelId: channel.id, externalId: event.externalUserId } },
          });
        });

  const conversation = await db.conversation.upsert({
    where: { contactId: contact.id },
    update: {},
    create: { workspaceId, contactId: contact.id, channelId: channel.id },
  });

  // ── Record the message (idempotent on the provider's message id) ──
  const text = (event.text ?? "").slice(0, 4000);
  const preview = event.kind === "image" ? (text ? `📷 ${text}` : "📷 Image") : text.slice(0, 140);
  const storeMessage = event.kind !== "ref" || text.length > 0;

  if (storeMessage) {
    try {
      await db.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          contactId: contact.id,
          direction: "IN",
          senderType: "CONTACT",
          kind: event.kind === "ref" ? "text" : event.kind,
          text,
          payload: event.imageUrl ? { imageUrl: event.imageUrl } : undefined,
          externalId: event.externalMessageId ?? null,
          status: "RECEIVED",
          createdAt: now,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return { contactId: contact.id, conversationId: conversation.id, automated: false, duplicate: true };
      }
      throw err;
    }
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, lastPreview: preview, unreadCount: { increment: 1 } },
    });
  }

  // ── Automation ──
  const automated = await automate();
  if (!automated && storeMessage) {
    // Nothing answered: surface the chat to the team.
    await db.conversation.updateMany({ where: { id: conversation.id, status: "CLOSED" }, data: { status: "OPEN" } });
  }
  return { contactId: contact.id, conversationId: conversation.id, automated };

  async function automate(): Promise<boolean> {
    // Human takeover: stay quiet while an agent is handling the chat.
    if (conversation.botPausedUntil && conversation.botPausedUntil > now) return false;

    // Workspaces over their contact limit keep receiving messages but lose automation for new contacts.
    if (isNew && !contact.isPreview) {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } });
      const total = await db.contact.count({ where: { workspaceId, isPreview: false } });
      if (total > planOf(ws?.plan).limits.contacts) return false;
    }

    if (event.kind === "postback" && event.payload) {
      const target = decodePostback(event.payload);
      if (!target) return false;
      return continueFromHandle({ ...target, contactId: contact.id });
    }

    if (event.kind === "ref") {
      const refFlow = await findRefFlow(workspaceId, event.ref ?? "");
      if (refFlow) return startFlow({ flowId: refFlow, contactId: contact.id, entry: "ref" });
    }

    if (event.kind === "text" && text) {
      if (await feedInput(contact.id, text)) return true;
      const keywordFlow = await findKeywordFlow(workspaceId, text);
      if (keywordFlow) return startFlow({ flowId: keywordFlow, contactId: contact.id, entry: "keyword" });
    }

    if (isNew || event.kind === "ref") {
      const welcome = await findTriggerFlow(workspaceId, "WELCOME");
      if (welcome) return startFlow({ flowId: welcome.flowId, contactId: contact.id, entry: "welcome" });
    }

    const fallback = await findTriggerFlow(workspaceId, "DEFAULT_REPLY");
    if (fallback) {
      const frequency = (fallback.config as { frequency?: string }).frequency ?? "always";
      if (frequency === "daily") {
        const recent = await db.flowRun.findFirst({
          where: {
            contactId: contact.id,
            flowId: fallback.flowId,
            entry: "default_reply",
            createdAt: { gt: new Date(now.getTime() - 86_400_000) },
          },
          select: { id: true },
        });
        if (recent) return false;
      }
      return startFlow({ flowId: fallback.flowId, contactId: contact.id, entry: "default_reply" });
    }
    return false;
  }
}
