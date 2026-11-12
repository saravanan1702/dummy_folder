import { z } from "zod";
import { authed, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { loadMe } from "@/lib/me";

export const GET = authed(async (auth) => loadMe(auth));

const patchSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const PATCH = authed(async ({ req, user }) => {
  const { name } = await readJson(req, patchSchema);
  await db.user.update({ where: { id: user.id }, data: { name } });
  return { ok: true };
});
