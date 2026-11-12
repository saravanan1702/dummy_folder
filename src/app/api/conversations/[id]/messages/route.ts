import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { deliver } from "@/lib/engine/deliver";
import { rateLimit } from "@/lib/rate-limit";
import { serializeMessage } from "@/lib/serializers";

export const GET = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const conversation = await db.conversation.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!conversation) throw notFound("Conversation");

  const sp = req.nextUrl.searchParams;
  const after = sp.get("after");
  const before = sp.get("before");
  const include = { senderUser: { select: { name: true } } } as const;

  if (after && !Number.isNaN(Date.parse(after))) {
    const rows = await db.message.findMany({
      where: { conversationId: conversation.id, createdAt: { gt: new Date(after) } },
      orderBy: { createdAt: "asc" },
      take: 200,
      include,
    });
    return { messages: rows.map(serializeMessage), hasMore: false };
  }

  const rows = await db.message.findMany({
    where: {
      conversationId: conversation.id,
      ...(before && !Number.isNaN(Date.parse(before)) ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include,
  });
  return { messages: rows.reverse().map(serializeMessage), hasMore: rows.length === 50 };
});

const schema = z.object({ text: z.string().trim().min(1, "Type a message first").max(4000) });

/** A human agent replies from the inbox. Pauses automation so the bot doesn't talk over them. */
export const POST = authed<{ id: string }>(async ({ req, params, workspace, user }) => {
  const { text } = await readJson(req, schema);
  await rateLimit(`agentmsg:${user.id}`, 120, 60);

  const conversation = await db.conversation.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: { contact: true, channel: true },
  });
  if (!conversation) throw notFound("Conversation");

  const message = await deliver({
    workspaceId: workspace.id,
    conversationId: conversation.id,
    contact: conversation.contact,
    channel: conversation.channel,
    message: { kind: "text", text },
    senderType: "AGENT",
    senderUserId: user.id,
  });

  const pauseMs = workspace.takeoverMinutes * 60_000;
  await db.$transaction([
    db.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "OPEN",
        unreadCount: 0,
        assigneeId: conversation.assigneeId ?? user.id,
        botPausedUntil:
          pauseMs > 0
            ? new Date(Math.max(Date.now() + pauseMs, conversation.botPausedUntil?.getTime() ?? 0))
            : conversation.botPausedUntil,
      },
    }),
    // An agent answering supersedes whatever question the bot was waiting on.
    db.flowRun.updateMany({
      where: { contactId: conversation.contactId, status: "WAITING_INPUT" },
      data: { status: "CANCELLED" },
    }),
  ]);

  return { message: serializeMessage({ ...message, senderUser: { name: user.name } }) };
});
