import type { Prisma } from "@/generated/prisma/client";
import { authed } from "@/lib/api";
import { db } from "@/lib/db";
import { serializeConversation } from "@/lib/serializers";

const conversationInclude = {
  contact: { include: { tags: { include: { tag: { select: { id: true, name: true } } } } } },
  channel: { select: { id: true, type: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const;

export const GET = authed(async ({ req, workspace, user }) => {
  const sp = req.nextUrl.searchParams;
  const where: Prisma.ConversationWhereInput = { workspaceId: workspace.id, contact: { isPreview: false } };

  const status = sp.get("status");
  if (status === "OPEN" || status === "CLOSED") where.status = status;

  const assignee = sp.get("assignee");
  if (assignee === "me") where.assigneeId = user.id;
  else if (assignee === "unassigned") where.assigneeId = null;

  const channel = sp.get("channel");
  if (channel) where.channelId = channel;

  const q = sp.get("q")?.trim();
  if (q) {
    where.contact = {
      isPreview: false,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const before = sp.get("before");
  if (before && !Number.isNaN(Date.parse(before))) where.lastMessageAt = { lt: new Date(before) };

  const [rows, open, mine] = await Promise.all([
    db.conversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, take: 40, include: conversationInclude }),
    db.conversation.count({ where: { workspaceId: workspace.id, status: "OPEN", contact: { isPreview: false } } }),
    db.conversation.count({
      where: { workspaceId: workspace.id, status: "OPEN", assigneeId: user.id, contact: { isPreview: false } },
    }),
  ]);

  return {
    conversations: rows.map(serializeConversation),
    hasMore: rows.length === 40,
    counts: { open, mine },
  };
});
