import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(1).max(50) });

export const PATCH = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const { name } = await readJson(req, schema);
  const res = await db.tag.updateMany({ where: { id: params.id, workspaceId: workspace.id }, data: { name } });
  if (res.count === 0) throw notFound("Tag");
  return { ok: true };
});

export const DELETE = authed<{ id: string }>(async ({ params, workspace }) => {
  const res = await db.tag.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
  if (res.count === 0) throw notFound("Tag");
  return { ok: true };
});
