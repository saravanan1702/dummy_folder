import { z } from "zod";
import { ApiError, authed, MANAGERS, readJson } from "@/lib/api";
import { serializeChannel } from "@/lib/channel-view";
import { ChannelError } from "@/lib/channels";
import { pageVerify, whatsappVerify } from "@/lib/channels/meta";
import { telegramGetMe, telegramSetWebhook } from "@/lib/channels/telegram";
import { encryptJson, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertWithinLimit } from "@/lib/workspace";

export const GET = authed(async ({ req, workspace }) => {
  const channels = await db.channel.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contacts: { where: { isPreview: false } } } } },
  });
  const base = appUrl(req);
  return { channels: channels.map((c) => serializeChannel(c, base, c._count.contacts)) };
});

const secret = z.string().trim().min(10, "That value looks too short").max(600);

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TELEGRAM"), token: secret }),
  z.object({
    type: z.literal("WHATSAPP"),
    phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "The phone number ID is a number from your Meta app"),
    token: secret,
    appSecret: secret,
  }),
  z.object({ type: z.literal("MESSENGER"), token: secret, appSecret: secret }),
  z.object({ type: z.literal("INSTAGRAM"), token: secret, appSecret: secret }),
]);

export const POST = authed(
  async ({ req, workspace }) => {
    const input = await readJson(req, schema);
    await assertWithinLimit(workspace, "channels");

    let externalId: string;
    let name: string;
    let config: Record<string, string> = {};
    let credentials: Record<string, string>;

    try {
      if (input.type === "TELEGRAM") {
        const me = await telegramGetMe(input.token);
        externalId = String(me.id);
        name = me.first_name || `@${me.username}`;
        config = { username: me.username };
        credentials = { token: input.token };
      } else if (input.type === "WHATSAPP") {
        const info = await whatsappVerify(input.phoneNumberId, input.token);
        externalId = input.phoneNumberId;
        name = info.verified_name || info.display_phone_number || "WhatsApp";
        config = { phone: info.display_phone_number ?? "" };
        credentials = { token: input.token, appSecret: input.appSecret };
      } else {
        const page = await pageVerify(input.token);
        credentials = { token: input.token, appSecret: input.appSecret };
        if (input.type === "INSTAGRAM") {
          const ig = page.instagram_business_account;
          if (!ig) throw new ChannelError("This Facebook Page has no Instagram professional account linked to it.");
          externalId = ig.id;
          name = ig.username ? `@${ig.username}` : (page.name ?? "Instagram");
          config = { username: ig.username ?? "", pageId: page.id };
        } else {
          externalId = page.id;
          name = page.name ?? "Facebook Page";
          config = { pageId: page.id };
        }
      }
    } catch (err) {
      if (err instanceof ChannelError) throw new ApiError(400, err.message);
      throw err;
    }

    // One provider account can only deliver its webhooks to one place.
    const clash = await db.channel.findFirst({ where: { type: input.type, externalId } });
    if (clash) {
      throw new ApiError(
        409,
        clash.workspaceId === workspace.id
          ? "This account is already connected to your workspace."
          : "This account is already connected to another workspace.",
      );
    }

    let channel = await db.channel.create({
      data: {
        workspaceId: workspace.id,
        type: input.type,
        name: name.slice(0, 80),
        externalId,
        credentials: encryptJson(credentials),
        webhookSecret: randomToken(24),
        config,
      },
    });

    if (input.type === "TELEGRAM") {
      // Telegram lets us register the webhook ourselves; Meta webhooks are set in the customer's app dashboard.
      try {
        await telegramSetWebhook(input.token, `${appUrl(req)}/api/webhooks/telegram/${channel.id}`, channel.webhookSecret);
      } catch (err) {
        channel = await db.channel.update({
          where: { id: channel.id },
          data: {
            status: "ERROR",
            lastError:
              err instanceof Error
                ? `${err.message}. Telegram needs a public https:// address — set APP_URL and reconnect.`
                : "Could not register the webhook.",
          },
        });
      }
    }
    return { channel: serializeChannel(channel, appUrl(req)) };
  },
  { roles: MANAGERS },
);
