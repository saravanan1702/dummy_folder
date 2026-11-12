import { z } from "zod";
import { planOf } from "@/config/plans";
import { authed, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { workspaceUsage } from "@/lib/workspace";

export const GET = authed(async ({ user, workspace, membership, workspaces }) => {
  const usage = await workspaceUsage(workspace.id);
  return {
    user,
    role: membership.role,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      plan: workspace.plan,
      takeoverMinutes: workspace.takeoverMinutes,
      subscriptionStatus: workspace.subscriptionStatus,
      currentPeriodEnd: workspace.currentPeriodEnd,
    },
    workspaces,
    usage,
    limits: planOf(workspace.plan).limits,
  };
});

const patchSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const PATCH = authed(async ({ req, user }) => {
  const { name } = await readJson(req, patchSchema);
  await db.user.update({ where: { id: user.id }, data: { name } });
  return { ok: true };
});
