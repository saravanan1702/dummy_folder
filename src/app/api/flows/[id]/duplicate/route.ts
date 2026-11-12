import { authed, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { assertWithinLimit } from "@/lib/workspace";

export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  const flow = await db.flow.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!flow) throw notFound("Flow");
  await assertWithinLimit(workspace, "flows");
  const copy = await db.flow.create({
    data: { workspaceId: workspace.id, name: `${flow.name} (copy)`.slice(0, 80), draft: flow.draft as object },
  });
  return { id: copy.id };
});
