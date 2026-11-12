import { z } from "zod";
import { brand } from "@/config/brand";
import { clientIp, open, readJson } from "@/lib/api";
import { randomToken } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { VISITOR_ID_RE, verifyWidgetToken, widgetToken } from "@/lib/widget";
import { loadWidgetChannel, visitorMessages, widgetConfig } from "@/lib/widget-server";

const schema = z.object({
  visitorId: z.string().max(80).optional(),
  token: z.string().max(200).optional(),
});

/** Opens (or resumes) an anonymous visitor session for the website chat widget. */
export const POST = open<{ channelId: string }>(async ({ req, params }) => {
  await rateLimit(`widget:session:${clientIp(req)}`, 60, 60);
  const channel = await loadWidgetChannel(params.channelId);
  const input = await readJson(req, schema);

  let visitorId = input.visitorId ?? "";
  let token = input.token ?? "";
  const resumed = VISITOR_ID_RE.test(visitorId) && verifyWidgetToken(channel.id, visitorId, token);
  if (!resumed) {
    // Ids are always issued by the server, so a visitor can't claim someone else's conversation.
    visitorId = randomToken(16);
    token = widgetToken(channel.id, visitorId);
  }

  return {
    visitorId,
    token,
    config: widgetConfig(channel),
    brand: brand.name,
    messages: resumed ? await visitorMessages(channel.id, visitorId) : [],
  };
});
