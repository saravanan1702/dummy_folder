import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { triggerConfigFor } from "@/lib/triggers";

const schema = z.object({
  enabled: z.boolean().optional(),
  flowId: z.string().min(1).max(40).optional(),
  config: z.unknown().optional(),
});

export const PATCH = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const input = await readJson(req, schema);
  const trigger = await db.trigger.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!trigger) throw notFound("Trigger");

  if (input.flowId) {
    const flow = await db.flow.findFirst({ where: { id: input.flowId, workspaceId: workspace.id } });
    if (!flow) throw notFound("Flow");
  }
  const config = input.config !== undefined ? triggerConfigFor[trigger.type].parse(input.config) : undefined;

  await db.trigger.update({
    where: { id: trigger.id },
    data: { enabled: input.enabled, flowId: input.flowId, config: config as object | undefined },
  });
  return { ok: true };
});

export const DELETE = authed<{ id: string }>(async ({ params, workspace }) => {
  const res = await db.trigger.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
  if (res.count === 0) throw notFound("Trigger");
  return { ok: true };
});
