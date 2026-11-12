import { z } from "zod";
import { authed, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { emptyGraph } from "@/lib/flow/types";
import { assertWithinLimit } from "@/lib/workspace";

export const GET = authed(async ({ workspace }) => {
  const flows = await db.flow.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      runCount: true,
      updatedAt: true,
      publishedAt: true,
      triggers: { select: { id: true, type: true, enabled: true, config: true } },
    },
  });
  return { flows };
});

const schema = z.object({ name: z.string().trim().min(1, "Give your flow a name").max(80) });

export const POST = authed(async ({ req, workspace }) => {
  const { name } = await readJson(req, schema);
  await assertWithinLimit(workspace, "flows");
  const flow = await db.flow.create({
    data: { workspaceId: workspace.id, name, draft: emptyGraph() as object },
  });
  return { id: flow.id };
});
