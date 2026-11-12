import { authed, notFound } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  const res = await db.flow.updateMany({
    where: { id: params.id, workspaceId: workspace.id },
    data: { status: "DRAFT" },
  });
  if (res.count === 0) throw notFound("Flow");
  return { ok: true };
});
