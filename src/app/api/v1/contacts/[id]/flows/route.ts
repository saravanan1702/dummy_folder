import { z } from "zod";
import { ApiError, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { startFlow } from "@/lib/engine/runner";
import { withApiKey } from "@/lib/public-api";

const schema = z.object({ flow_id: z.string().min(1).max(40) });

/** POST /api/v1/contacts/:id/flows  { "flow_id": "…" } – starts a published flow for the contact. */
export const POST = withApiKey<{ id: string }>(async ({ req, params, workspace }) => {
  const { flow_id } = await readJson(req, schema);
  const [contact, flow] = await Promise.all([
    db.contact.findFirst({ where: { id: params.id, workspaceId: workspace.id } }),
    db.flow.findFirst({ where: { id: flow_id, workspaceId: workspace.id } }),
  ]);
  if (!contact) throw notFound("Contact");
  if (!flow) throw notFound("Flow");
  if (flow.status !== "PUBLISHED") throw new ApiError(400, "The flow is not published");
  const started = await startFlow({ flowId: flow.id, contactId: contact.id, entry: "api" });
  if (!started) throw new ApiError(400, "The flow could not be started");
  return { ok: true };
});
