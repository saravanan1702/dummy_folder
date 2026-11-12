import { z } from "zod";
import { notFound, open, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSuperadminApi } from "@/lib/superadmin";

const schema = z.object({ plan: z.enum(["FREE", "PRO", "BUSINESS"]) });

/** Manually set a workspace's plan (comped accounts, support fixes). Stripe stays the source of truth for paying customers. */
export const PATCH = open<{ id: string }>(
  async ({ req, params }) => {
    await requireSuperadminApi();
    const { plan } = await readJson(req, schema);
    const res = await db.workspace.updateMany({ where: { id: params.id }, data: { plan } });
    if (res.count === 0) throw notFound("Workspace");
    return { ok: true };
  },
  { sameOrigin: true },
);
