import { NextResponse } from "next/server";
import { authed, badRequest, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { parseGraph } from "@/lib/engine/runner";
import { validateGraph } from "@/lib/flow/types";

/** Makes the current draft live. Refuses when the draft has problems that would break it. */
export const POST = authed<{ id: string }>(async ({ params, workspace }) => {
  const flow = await db.flow.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!flow) throw notFound("Flow");
  const graph = parseGraph(flow.draft);
  if (!graph) throw badRequest("This flow is corrupted and can't be published.");

  const issues = validateGraph(graph);
  if (issues.length > 0) {
    return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }
  await db.flow.update({
    where: { id: flow.id },
    data: { status: "PUBLISHED", published: graph as object, publishedAt: new Date() },
  });
  return { ok: true };
});
