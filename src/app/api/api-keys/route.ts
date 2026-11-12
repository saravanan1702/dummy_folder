import { z } from "zod";
import { ApiError, authed, MANAGERS, readJson } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";

export const GET = authed(
  async ({ workspace }) => {
    const keys = await db.apiKey.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    });
    return { keys, available: workspace.plan !== "FREE" };
  },
  { roles: MANAGERS },
);

const schema = z.object({ name: z.string().trim().min(1, "Name the key so you can recognise it later").max(60) });

export const POST = authed(
  async ({ req, workspace }) => {
    const { name } = await readJson(req, schema);
    if (workspace.plan === "FREE") {
      throw new ApiError(402, "The REST API is available on the Pro plan and above.", "plan_limit");
    }
    const count = await db.apiKey.count({ where: { workspaceId: workspace.id } });
    if (count >= 20) throw new ApiError(400, "You've reached the maximum number of API keys.");

    const key = `cv_${randomToken(30)}`;
    const row = await db.apiKey.create({
      data: { workspaceId: workspace.id, name, prefix: key.slice(0, 9), keyHash: sha256(key) },
    });
    // The full key is shown exactly once; only its hash is stored.
    return { id: row.id, key };
  },
  { roles: MANAGERS },
);
