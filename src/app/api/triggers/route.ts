import { z } from "zod";
import { ApiError, authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { triggerInput } from "@/lib/triggers";

export const GET = authed(async ({ workspace }) => {
  const triggers = await db.trigger.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    include: { flow: { select: { id: true, name: true, status: true } } },
  });
  return {
    triggers: triggers.map((t) => ({
      id: t.id,
      type: t.type,
      enabled: t.enabled,
      config: t.config,
      flow: t.flow,
      createdAt: t.createdAt,
    })),
  };
});

const schema = z.object({ flowId: z.string().min(1).max(40) }).and(triggerInput);

export const POST = authed(async ({ req, workspace }) => {
  const input = await readJson(req, schema);
  const flow = await db.flow.findFirst({ where: { id: input.flowId, workspaceId: workspace.id } });
  if (!flow) throw notFound("Flow");

  if (input.type === "WELCOME" || input.type === "DEFAULT_REPLY") {
    // These are singletons: choosing a new flow replaces the previous choice.
    await db.trigger.deleteMany({ where: { workspaceId: workspace.id, type: input.type } });
  }
  if (input.type === "REF_LINK") {
    const clash = (await db.trigger.findMany({ where: { workspaceId: workspace.id, type: "REF_LINK" } })).some(
      (t) => (t.config as { ref?: string }).ref === input.config.ref,
    );
    if (clash) throw new ApiError(409, "Another link already uses that reference code.");
  }
  const count = await db.trigger.count({ where: { workspaceId: workspace.id } });
  if (count >= 500) throw new ApiError(400, "You've reached the maximum number of triggers.");

  const trigger = await db.trigger.create({
    data: { workspaceId: workspace.id, flowId: flow.id, type: input.type, config: input.config },
  });
  return { id: trigger.id };
});
