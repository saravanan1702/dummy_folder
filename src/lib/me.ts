import { planOf } from "@/config/plans";
import type { AuthContext } from "./auth";
import { db } from "./db";
import { isSuperadmin } from "./superadmin";
import { workspaceUsage } from "./workspace";

/** Everything the dashboard shell needs about the signed-in user and active workspace. */
export async function loadMe(auth: AuthContext) {
  const { user, workspace, membership, workspaces } = auth;
  const [usage, openConversations] = await Promise.all([
    workspaceUsage(workspace.id),
    db.conversation.count({ where: { workspaceId: workspace.id, status: "OPEN", contact: { isPreview: false } } }),
  ]);
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
      currentPeriodEnd: workspace.currentPeriodEnd ? workspace.currentPeriodEnd.toISOString() : null,
    },
    workspaces,
    usage,
    limits: planOf(workspace.plan).limits,
    openConversations,
    superadmin: isSuperadmin(user.email),
  };
}

export type Me = Awaited<ReturnType<typeof loadMe>>;
