import { z } from "zod";
import { ApiError, authed, badRequest, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { countAudience } from "@/lib/engine/broadcast";
import { enqueue } from "@/lib/engine/jobs";
import { audienceSchema, scopeAudience } from "@/lib/broadcasts";
import { assertWithinLimit } from "@/lib/workspace";

export const GET = authed(async ({ workspace }) => {
  const broadcasts = await db.broadcast.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { flow: { select: { id: true, name: true } } },
  });
  return {
    broadcasts: broadcasts.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      text: b.text,
      flow: b.flow,
      audience: b.audience,
      scheduledAt: b.scheduledAt,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      total: b.total,
      sent: b.sent,
      failed: b.failed,
      createdAt: b.createdAt,
    })),
  };
});

const schema = z.object({
  name: z.string().trim().min(1, "Give your broadcast a name").max(80),
  text: z.string().trim().max(2000).optional(),
  flowId: z.string().max(40).optional(),
  audience: audienceSchema,
  /** ISO timestamp; omit to send right away. */
  scheduledAt: z.string().datetime().optional(),
});

export const POST = authed(async ({ req, workspace }) => {
  const input = await readJson(req, schema);
  if (!input.text && !input.flowId) throw badRequest("Write a message or choose a flow to send.");

  if (input.flowId) {
    const flow = await db.flow.findFirst({ where: { id: input.flowId, workspaceId: workspace.id } });
    if (!flow) throw notFound("Flow");
    if (flow.status !== "PUBLISHED") throw badRequest("Publish the flow before broadcasting it.");
  }
  await assertWithinLimit(workspace, "broadcastsThisMonth");

  const audience = await scopeAudience(workspace.id, input.audience);
  const reach = await countAudience(workspace.id, audience);
  if (reach === 0) throw new ApiError(400, "No contacts match this audience right now.");

  const runAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
  if (runAt.getTime() < Date.now() - 60_000) throw badRequest("The scheduled time is in the past.");

  const broadcast = await db.broadcast.create({
    data: {
      workspaceId: workspace.id,
      name: input.name,
      text: input.flowId ? null : input.text,
      flowId: input.flowId ?? null,
      audience,
      status: "SCHEDULED",
      scheduledAt: runAt,
      total: reach,
    },
  });
  await enqueue("broadcast.start", { broadcastId: broadcast.id }, runAt);
  return { id: broadcast.id };
});
