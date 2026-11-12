import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { WINDOWED_CHANNELS } from "../channels";
import { deliver } from "./deliver";
import { enqueue } from "./jobs";
import { startFlow } from "./runner";
import { contactVariables, renderTemplate } from "./template";

export interface Audience {
  channelIds?: string[];
  tagIds?: string[];
  tagMatch?: "any" | "all";
  excludeTagIds?: string[];
}

const BATCH_SIZE = 40;
const CONCURRENCY = 5;

/**
 * Contacts a broadcast may reach: subscribed, matching the tag filters and –
 * for WhatsApp / Messenger / Instagram – active within the 24h messaging window.
 */
export function audienceWhere(workspaceId: string, audience: Audience): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [
    {
      OR: [
        { channel: { type: { notIn: WINDOWED_CHANNELS } } },
        { lastInboundAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
      ],
    },
  ];
  if (audience.channelIds?.length) and.push({ channelId: { in: audience.channelIds } });
  if (audience.tagIds?.length) {
    if (audience.tagMatch === "all") {
      for (const tagId of audience.tagIds) and.push({ tags: { some: { tagId } } });
    } else {
      and.push({ tags: { some: { tagId: { in: audience.tagIds } } } });
    }
  }
  if (audience.excludeTagIds?.length) {
    and.push({ tags: { none: { tagId: { in: audience.excludeTagIds } } } });
  }
  return {
    workspaceId,
    status: "SUBSCRIBED",
    isPreview: false,
    channel: { status: { not: "DISABLED" } },
    AND: and,
  };
}

export async function countAudience(workspaceId: string, audience: Audience): Promise<number> {
  return db.contact.count({ where: audienceWhere(workspaceId, audience) });
}

/** Job: moves a broadcast into SENDING and schedules its first batch. */
export async function startBroadcast(broadcastId: string): Promise<void> {
  const claimed = await db.broadcast.updateMany({
    where: { id: broadcastId, status: "SCHEDULED" },
    data: { status: "SENDING", startedAt: new Date() },
  });
  if (claimed.count === 0) return; // cancelled, or already started
  const broadcast = await db.broadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  const total = await countAudience(broadcast.workspaceId, broadcast.audience as Audience);
  await db.broadcast.update({ where: { id: broadcastId }, data: { total } });
  await enqueue("broadcast.batch", { broadcastId, cursor: null });
}

/** Job: sends one page of recipients, then schedules the next page. */
export async function sendBroadcastBatch(broadcastId: string, cursor: string | null): Promise<void> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast || broadcast.status !== "SENDING") return;

  const contacts = await db.contact.findMany({
    where: {
      ...audienceWhere(broadcast.workspaceId, broadcast.audience as Audience),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
    include: { channel: true },
  });

  if (contacts.length === 0) {
    await db.broadcast.update({ where: { id: broadcastId }, data: { status: "SENT", completedAt: new Date() } });
    return;
  }

  // Idempotency: if this batch is retried, skip contacts that already got the broadcast.
  const already = new Set(
    (
      await db.message.findMany({
        where: { broadcastId, contactId: { in: contacts.map((c) => c.id) } },
        select: { contactId: true },
        distinct: ["contactId"],
      })
    ).map((m) => m.contactId),
  );

  let sent = 0;
  let failed = 0;
  const queue = contacts.filter((c) => !already.has(c.id));

  async function worker() {
    for (let contact = queue.shift(); contact; contact = queue.shift()) {
      try {
        if (broadcast!.flowId) {
          const before = new Date();
          const ok = await startFlow({
            flowId: broadcast!.flowId,
            contactId: contact.id,
            entry: "broadcast",
            broadcastId,
          });
          const delivered = ok
            ? await db.message.count({
                where: { broadcastId, contactId: contact.id, status: "SENT", createdAt: { gte: before } },
              })
            : 0;
          if (delivered > 0) sent++;
          else failed++;
        } else {
          const conversation = await db.conversation.upsert({
            where: { contactId: contact.id },
            update: {},
            create: { workspaceId: contact.workspaceId, contactId: contact.id, channelId: contact.channelId },
          });
          const message = await deliver({
            workspaceId: contact.workspaceId,
            conversationId: conversation.id,
            contact,
            channel: contact.channel,
            message: { kind: "text", text: renderTemplate(broadcast!.text ?? "", contactVariables(contact)) },
            senderType: "BOT",
            broadcastId,
          });
          if (message.status === "SENT") sent++;
          else failed++;
        }
      } catch (err) {
        failed++;
        console.error(`[broadcast ${broadcastId}] contact ${contact.id} failed:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await db.broadcast.update({
    where: { id: broadcastId },
    data: { sent: { increment: sent }, failed: { increment: failed } },
  });
  await enqueue("broadcast.batch", { broadcastId, cursor: contacts[contacts.length - 1].id });
}
