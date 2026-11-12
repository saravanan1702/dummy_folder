import { ApiError, authed } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  // Batches check the status before sending, so a broadcast in flight stops at the next batch.
  const res = await db.broadcast.updateMany({
    where: { id: params.id, workspaceId: workspace.id, status: { in: ["SCHEDULED", "SENDING"] } },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  if (res.count === 0) throw new ApiError(400, "This broadcast can no longer be cancelled.");
  return { ok: true };
});
