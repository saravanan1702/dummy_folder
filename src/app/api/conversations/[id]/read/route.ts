import { authed } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  await db.conversation.updateMany({
    where: { id: params.id, workspaceId: workspace.id, unreadCount: { gt: 0 } },
    data: { unreadCount: 0 },
  });
  return { ok: true };
});
