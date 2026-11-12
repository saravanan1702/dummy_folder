import { authed, MANAGERS, notFound } from "@/lib/api";
import { db } from "@/lib/db";

export const DELETE = authed<{ id: string }>(
  async ({ params, workspace }) => {
    const res = await db.apiKey.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
    if (res.count === 0) throw notFound("API key");
    return { ok: true };
  },
  { roles: MANAGERS },
);
