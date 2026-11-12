import { ApiError, authed, notFound } from "@/lib/api";
import { db } from "@/lib/db";

export const DELETE = authed<{ id: string }>(async ({ params, workspace }) => {
  const broadcast = await db.broadcast.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!broadcast) throw notFound("Broadcast");
  if (broadcast.status === "SENDING") throw new ApiError(400, "Cancel the broadcast before deleting it.");
  await db.broadcast.delete({ where: { id: broadcast.id } });
  return { ok: true };
});
