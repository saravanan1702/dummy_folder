import { ApiError, authed, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { startFlow } from "@/lib/engine/runner";
import { widgetToken } from "@/lib/widget";

/**
 * Runs the flow's current draft against a private test contact in the website
 * chat, and returns a link to watch it. Each preview starts from a clean slate.
 */
export const POST = authed<{ id: string }>(async ({ params, workspace, user }) => {
  const flow = await db.flow.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!flow) throw notFound("Flow");
  const channel = await db.channel.findFirst({
    where: { workspaceId: workspace.id, type: "WEBCHAT" },
    orderBy: { createdAt: "asc" },
  });
  if (!channel) throw new ApiError(400, "Your workspace has no website chat channel to preview in.");

  const visitorId = `preview-${user.id}`;
  await db.contact.deleteMany({ where: { channelId: channel.id, externalId: visitorId } });
  const contact = await db.contact.create({
    data: {
      workspaceId: workspace.id,
      channelId: channel.id,
      externalId: visitorId,
      firstName: user.name.split(" ")[0] || "Tester",
      lastName: user.name.split(" ").slice(1).join(" ") || null,
      email: user.email,
      isPreview: true,
      source: "preview",
    },
  });

  const started = await startFlow({ flowId: flow.id, contactId: contact.id, entry: "preview", preview: true });
  if (!started) throw new ApiError(400, "This flow has no starting step yet.");

  const token = widgetToken(channel.id, visitorId);
  return { url: `/widget/${channel.id}?preview=1&vid=${encodeURIComponent(visitorId)}&token=${encodeURIComponent(token)}` };
});
