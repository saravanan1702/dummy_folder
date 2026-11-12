import type { Channel, Message } from "@/generated/prisma/client";
import { ApiError } from "./api";
import { db } from "./db";
import { VISITOR_ID_RE, verifyWidgetToken } from "./widget";
import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "./workspace";

export async function loadWidgetChannel(channelId: string): Promise<Channel> {
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.type !== "WEBCHAT" || channel.status !== "ACTIVE") {
    throw new ApiError(404, "Chat is unavailable");
  }
  return channel;
}

export function widgetConfig(channel: Channel): WidgetConfig {
  return { ...DEFAULT_WIDGET_CONFIG, ...((channel.config ?? {}) as Partial<WidgetConfig>) };
}

/** Reads and verifies `Authorization: Visitor <visitorId>.<token>`. */
export function visitorFromRequest(req: Request, channelId: string): string {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Visitor ([^.\s]+)\.([^.\s]+)$/);
  if (!match || !VISITOR_ID_RE.test(match[1]) || !verifyWidgetToken(channelId, match[1], match[2])) {
    throw new ApiError(401, "Invalid chat session");
  }
  return match[1];
}

export function widgetMessage(m: Message & { senderUser?: { name: string } | null }) {
  const payload = (m.payload ?? {}) as {
    imageUrl?: string;
    buttons?: { label: string; payload?: string; url?: string }[];
    quickReplies?: { label: string; payload: string }[];
  };
  return {
    id: m.id,
    from: m.direction === "IN" ? ("visitor" as const) : m.senderType === "AGENT" ? ("agent" as const) : ("bot" as const),
    // Only the agent's first name is shown to the public.
    agentName: m.senderType === "AGENT" ? (m.senderUser?.name?.split(" ")[0] ?? null) : null,
    kind: m.kind,
    text: m.text ?? "",
    imageUrl: payload.imageUrl ?? null,
    buttons: payload.buttons ?? [],
    quickReplies: payload.quickReplies ?? [],
    at: m.createdAt,
  };
}
export type WidgetMessage = ReturnType<typeof widgetMessage>;

export async function visitorMessages(channelId: string, visitorId: string, after?: Date): Promise<WidgetMessage[]> {
  const contact = await db.contact.findUnique({
    where: { channelId_externalId: { channelId, externalId: visitorId } },
    select: { id: true },
  });
  if (!contact) return [];
  const rows = await db.message.findMany({
    where: { contactId: contact.id, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: 100,
    include: { senderUser: { select: { name: true } } },
  });
  return (after ? rows : rows.reverse()).map(widgetMessage);
}
