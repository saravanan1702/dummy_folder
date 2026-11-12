import { z } from "zod";
import { badRequest, clientIp, open, readJson } from "@/lib/api";
import { handleInbound } from "@/lib/engine/inbound";
import { rateLimit } from "@/lib/rate-limit";
import { loadWidgetChannel, visitorFromRequest, visitorMessages } from "@/lib/widget-server";

function parseAfter(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

/** Polled by the widget for new messages from the bot or an agent. */
export const GET = open<{ channelId: string }>(async ({ req, params }) => {
  const channel = await loadWidgetChannel(params.channelId);
  const visitorId = visitorFromRequest(req, channel.id);
  await rateLimit(`widget:poll:${visitorId}`, 90, 60);
  const messages = await visitorMessages(channel.id, visitorId, parseAfter(req.nextUrl.searchParams.get("after")));
  return { messages };
});

const schema = z.object({
  text: z.string().trim().max(2000).optional(),
  /** Button / quick-reply click. */
  postback: z.object({ payload: z.string().min(1).max(200), label: z.string().max(100) }).optional(),
  after: z.string().max(40).optional(),
});

/** A visitor sends a message or taps a button. Automation runs inline so the reply comes back in the response. */
export const POST = open<{ channelId: string }>(async ({ req, params }) => {
  const channel = await loadWidgetChannel(params.channelId);
  const visitorId = visitorFromRequest(req, channel.id);
  await rateLimit(`widget:send:${visitorId}`, 30, 60);
  await rateLimit(`widget:send:ip:${clientIp(req)}`, 120, 60);

  const input = await readJson(req, schema);
  if (!input.text && !input.postback) throw badRequest("Type a message first");

  await handleInbound(
    channel,
    input.postback
      ? { externalUserId: visitorId, kind: "postback", payload: input.postback.payload, text: input.postback.label }
      : { externalUserId: visitorId, kind: "text", text: input.text },
  );

  return { messages: await visitorMessages(channel.id, visitorId, parseAfter(input.after)) };
});
