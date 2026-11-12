import { z } from "zod";
import { authed, readJson } from "@/lib/api";
import { audienceSchema, scopeAudience } from "@/lib/broadcasts";
import { countAudience } from "@/lib/engine/broadcast";

const schema = z.object({ audience: audienceSchema });

/** How many contacts a broadcast with this audience would reach right now. */
export const POST = authed(async ({ req, workspace }) => {
  const { audience } = await readJson(req, schema);
  const scoped = await scopeAudience(workspace.id, audience);
  return { count: await countAudience(workspace.id, scoped) };
});
