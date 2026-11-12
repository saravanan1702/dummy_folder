import { z } from "zod";
import { authed, MANAGERS, readJson } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  takeoverMinutes: z.number().int().min(0).max(1440).optional(),
});

export const PATCH = authed(
  async ({ req, workspace }) => {
    const data = await readJson(req, schema);
    await db.workspace.update({ where: { id: workspace.id }, data });
    return { ok: true };
  },
  { roles: MANAGERS },
);
