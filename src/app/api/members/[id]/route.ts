import { z } from "zod";
import { ApiError, authed, forbidden, MANAGERS, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ role: z.enum(["ADMIN", "AGENT"]) });

async function loadTarget(id: string, workspaceId: string) {
  const target = await db.membership.findFirst({ where: { id, workspaceId } });
  if (!target) throw notFound("Team member");
  if (target.role === "OWNER") throw new ApiError(400, "The workspace owner can't be changed or removed.");
  return target;
}

export const PATCH = authed<{ id: string }>(
  async ({ req, params, workspace, membership }) => {
    const { role } = await readJson(req, schema);
    const target = await loadTarget(params.id, workspace.id);
    if (target.id === membership.id) throw forbidden("You can't change your own role.");
    await db.membership.update({ where: { id: target.id }, data: { role } });
    return { ok: true };
  },
  { roles: MANAGERS },
);

export const DELETE = authed<{ id: string }>(async ({ params, workspace, membership }) => {
  const target = await loadTarget(params.id, workspace.id);
  // Managers can remove anyone but the owner; everyone can leave on their own.
  const self = target.id === membership.id;
  if (!self && membership.role === "AGENT") throw forbidden();
  await db.$transaction([
    db.conversation.updateMany({
      where: { workspaceId: workspace.id, assigneeId: target.userId },
      data: { assigneeId: null },
    }),
    db.membership.delete({ where: { id: target.id } }),
  ]);
  return { ok: true };
});
