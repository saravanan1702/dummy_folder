import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { setActiveWorkspace } from "@/lib/auth";

const schema = z.object({ id: z.string().min(1).max(40) });

export const POST = authed(async ({ req, workspaces }) => {
  const { id } = await readJson(req, schema);
  if (!workspaces.some((w) => w.id === id)) throw notFound("Workspace");
  await setActiveWorkspace(id);
  return { ok: true };
});
