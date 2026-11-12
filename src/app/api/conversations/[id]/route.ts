import { z } from "zod";
import { authed, badRequest, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { serializeConversation } from "@/lib/serializers";

const include = {
  contact: { include: { tags: { include: { tag: { select: { id: true, name: true } } } } } },
  channel: { select: { id: true, type: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const;

export const GET = authed<{ id: string }>(async ({ params, workspace }) => {
  const conversation = await db.conversation.findFirst({ where: { id: params.id, workspaceId: workspace.id }, include });
  if (!conversation) throw notFound("Conversation");
  return { conversation: serializeConversation(conversation) };
});

const schema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  assigneeId: z.string().max(40).nullable().optional(),
  botPaused: z.boolean().optional(),
});

const MANUAL_PAUSE_MS = 24 * 3_600_000;

export const PATCH = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const input = await readJson(req, schema);
  const existing = await db.conversation.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!existing) throw notFound("Conversation");

  const data: {
    status?: "OPEN" | "CLOSED";
    assigneeId?: string | null;
    botPausedUntil?: Date | null;
    unreadCount?: number;
  } = {};

  if (input.assigneeId !== undefined) {
    if (input.assigneeId) {
      const member = await db.membership.findFirst({ where: { workspaceId: workspace.id, userId: input.assigneeId } });
      if (!member) throw badRequest("That person isn't on your team.");
    }
    data.assigneeId = input.assigneeId;
  }
  if (input.botPaused !== undefined) {
    data.botPausedUntil = input.botPaused ? new Date(Date.now() + MANUAL_PAUSE_MS) : null;
  }
  if (input.status) {
    data.status = input.status;
    if (input.status === "CLOSED") {
      // Closing hands the chat back to automation.
      data.botPausedUntil = null;
      data.unreadCount = 0;
    }
  }

  const conversation = await db.conversation.update({ where: { id: existing.id }, data, include });
  return { conversation: serializeConversation(conversation) };
});
