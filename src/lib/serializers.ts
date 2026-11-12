import type { Channel, Contact, Conversation, Message, Tag } from "@/generated/prisma/client";
import { contactName } from "./contacts";

type ContactWithRels = Contact & {
  tags?: { tag: Pick<Tag, "id" | "name"> }[];
  channel?: Pick<Channel, "id" | "type" | "name">;
};

export function serializeContact(c: ContactWithRels) {
  return {
    id: c.id,
    name: contactName(c),
    firstName: c.firstName,
    lastName: c.lastName,
    username: c.username,
    email: c.email,
    phone: c.phone,
    avatarUrl: c.avatarUrl,
    status: c.status,
    fields: (c.fields ?? {}) as Record<string, string>,
    source: c.source,
    channelId: c.channelId,
    channelType: c.channel?.type ?? null,
    channelName: c.channel?.name ?? null,
    tags: (c.tags ?? []).map((t) => ({ id: t.tag.id, name: t.tag.name })),
    lastInboundAt: c.lastInboundAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
export type ContactDTO = ReturnType<typeof serializeContact>;

export function serializeMessage(m: Message & { senderUser?: { name: string } | null }) {
  return {
    id: m.id,
    direction: m.direction,
    senderType: m.senderType,
    senderName: m.senderUser?.name ?? null,
    kind: m.kind,
    text: m.text,
    payload: (m.payload ?? null) as {
      imageUrl?: string;
      buttons?: { label: string; payload?: string; url?: string }[];
      quickReplies?: { label: string; payload: string }[];
    } | null,
    status: m.status,
    error: m.error,
    createdAt: m.createdAt,
  };
}
export type MessageDTO = ReturnType<typeof serializeMessage>;

export function serializeConversation(
  c: Conversation & {
    contact: ContactWithRels;
    channel: Pick<Channel, "id" | "type" | "name">;
    assignee?: { id: string; name: string } | null;
  },
) {
  return {
    id: c.id,
    status: c.status,
    unreadCount: c.unreadCount,
    lastMessageAt: c.lastMessageAt,
    lastPreview: c.lastPreview,
    botPaused: !!c.botPausedUntil && c.botPausedUntil > new Date(),
    botPausedUntil: c.botPausedUntil,
    assignee: c.assignee ? { id: c.assignee.id, name: c.assignee.name } : null,
    channel: { id: c.channel.id, type: c.channel.type, name: c.channel.name },
    contact: serializeContact({ ...c.contact, channel: c.channel }),
  };
}
export type ConversationDTO = ReturnType<typeof serializeConversation>;
