import type { Channel, Message, SenderType } from "@/generated/prisma/client";
import { db } from "../db";
import { sendViaChannel, type OutboundMessage } from "../channels";

export interface DeliverOptions {
  workspaceId: string;
  conversationId: string;
  contact: { id: string; externalId: string };
  channel: Pick<Channel, "id" | "type" | "externalId" | "credentials" | "status">;
  message: OutboundMessage;
  senderType: Extract<SenderType, "BOT" | "AGENT" | "SYSTEM">;
  senderUserId?: string | null;
  flowId?: string | null;
  broadcastId?: string | null;
}

export function previewOf(message: { kind: string; text?: string | null }): string {
  if (message.kind === "image") return message.text ? `📷 ${message.text}` : "📷 Image";
  return (message.text ?? "").slice(0, 140);
}

/** Sends a message to the contact and records it in the conversation. Never throws on provider errors. */
export async function deliver(opts: DeliverOptions): Promise<Message> {
  const { message } = opts;
  let status: "SENT" | "FAILED" = "SENT";
  let error: string | null = null;
  let externalId: string | undefined;

  try {
    const res = await sendViaChannel(opts.channel, opts.contact.externalId, message);
    externalId = res.externalId;
  } catch (err) {
    status = "FAILED";
    error = err instanceof Error ? err.message.slice(0, 500) : "Delivery failed";
  }

  const payload: Record<string, unknown> = {};
  if (message.imageUrl) payload.imageUrl = message.imageUrl;
  if (message.buttons?.length) payload.buttons = message.buttons;
  if (message.quickReplies?.length) payload.quickReplies = message.quickReplies;

  const now = new Date();
  const [saved] = await db.$transaction([
    db.message.create({
      data: {
        workspaceId: opts.workspaceId,
        conversationId: opts.conversationId,
        contactId: opts.contact.id,
        direction: "OUT",
        senderType: opts.senderType,
        senderUserId: opts.senderUserId ?? null,
        kind: message.kind,
        text: message.text ?? null,
        payload: Object.keys(payload).length ? (payload as object) : undefined,
        // Provider ids are only unique per chat for some channels; prefix keeps them apart from inbound ids.
        externalId: externalId ? `out:${externalId}` : null,
        status,
        error,
        flowId: opts.flowId ?? null,
        broadcastId: opts.broadcastId ?? null,
        createdAt: now,
      },
    }),
    db.conversation.update({
      where: { id: opts.conversationId },
      data: { lastMessageAt: now, lastPreview: previewOf(message) },
    }),
  ]);
  return saved;
}
