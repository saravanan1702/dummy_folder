import { authed } from "@/lib/api";
import { assertWithinLimit, installTemplate } from "@/lib/workspace";

/** Copies a gallery template into the workspace as an editable draft flow. */
export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  await assertWithinLimit(workspace, "flows");
  const flow = await installTemplate(workspace.id, params.id, { withKeywords: true });
  return { id: flow.id };
});
