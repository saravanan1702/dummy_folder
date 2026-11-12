import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { graphSchema } from "@/lib/flow/types";

export const GET = authed<{ id: string }>(async ({ params, workspace }) => {
  const flow = await db.flow.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: { triggers: { select: { id: true, type: true, enabled: true, config: true } } },
  });
  if (!flow) throw notFound("Flow");
  return {
    flow: {
      id: flow.id,
      name: flow.name,
      status: flow.status,
      draft: flow.draft,
      runCount: flow.runCount,
      publishedAt: flow.publishedAt,
      updatedAt: flow.updatedAt,
      hasUnpublishedChanges:
        flow.status !== "PUBLISHED" || JSON.stringify(flow.draft) !== JSON.stringify(flow.published),
      triggers: flow.triggers,
    },
  };
});

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  draft: graphSchema.optional(),
});

export const PATCH = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const input = await readJson(req, schema);
  const res = await db.flow.updateMany({
    where: { id: params.id, workspaceId: workspace.id },
    data: { name: input.name, draft: input.draft as object | undefined },
  });
  if (res.count === 0) throw notFound("Flow");
  return { ok: true };
});

export const DELETE = authed<{ id: string }>(async ({ params, workspace }) => {
  const res = await db.flow.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
  if (res.count === 0) throw notFound("Flow");
  return { ok: true };
});
