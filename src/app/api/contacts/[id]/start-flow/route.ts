import { z } from "zod";
import { ApiError, authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { startFlow } from "@/lib/engine/runner";

const schema = z.object({ flowId: z.string().min(1).max(40) });

/** Manually sends a published flow to one contact (from the inbox or contact profile). */
export const POST = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const { flowId } = await readJson(req, schema);
  const [contact, flow] = await Promise.all([
    db.contact.findFirst({ where: { id: params.id, workspaceId: workspace.id } }),
    db.flow.findFirst({ where: { id: flowId, workspaceId: workspace.id } }),
  ]);
  if (!contact) throw notFound("Contact");
  if (!flow) throw notFound("Flow");
  if (flow.status !== "PUBLISHED") throw new ApiError(400, "Publish the flow before sending it.");
  const started = await startFlow({ flowId: flow.id, contactId: contact.id, entry: "manual" });
  if (!started) throw new ApiError(400, "The flow could not be started.");
  return { ok: true };
});
