import { z } from "zod";
import { ApiError, authed, readJson } from "@/lib/api";
import { setActiveWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWorkspace } from "@/lib/workspace";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export const POST = authed(async ({ req, user }) => {
  const { name } = await readJson(req, schema);
  const owned = await db.membership.count({ where: { userId: user.id, role: "OWNER" } });
  if (owned >= 10) throw new ApiError(400, "You've reached the maximum number of workspaces for one account.");
  const workspace = await createWorkspace(user.id, name);
  await setActiveWorkspace(workspace.id);
  return { id: workspace.id };
});
