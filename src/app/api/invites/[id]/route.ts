import { authed, MANAGERS } from "@/lib/api";
import { db } from "@/lib/db";

export const DELETE = authed<{ id: string }>(
  async ({ params, workspace }) => {
    await db.invite.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
    return { ok: true };
  },
  { roles: MANAGERS },
);
