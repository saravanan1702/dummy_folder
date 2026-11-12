import { z } from "zod";
import { authed, MANAGERS, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ label: z.string().trim().min(1).max(60) });

export const PATCH = authed<{ id: string }>(
  async ({ req, params, workspace }) => {
    const { label } = await readJson(req, schema);
    const res = await db.customField.updateMany({ where: { id: params.id, workspaceId: workspace.id }, data: { label } });
    if (res.count === 0) throw notFound("Field");
    return { ok: true };
  },
  { roles: MANAGERS },
);

export const DELETE = authed<{ id: string }>(
  async ({ params, workspace }) => {
    const res = await db.customField.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
    if (res.count === 0) throw notFound("Field");
    return { ok: true };
  },
  { roles: MANAGERS },
);
