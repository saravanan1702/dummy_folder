import { z } from "zod";
import { ApiError, authed, MANAGERS, notFound, readJson } from "@/lib/api";
import { serializeChannel } from "@/lib/channel-view";
import { channelCredentials } from "@/lib/channels";
import { telegramDeleteWebhook, telegramSetWebhook } from "@/lib/channels/telegram";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";

const widget = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6246EA"),
  title: z.string().trim().min(1).max(60),
  greeting: z.string().trim().max(300),
  position: z.enum(["left", "right"]),
  placeholder: z.string().trim().max(80),
});

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  widget: widget.partial().optional(),
  /** Telegram only: register the webhook again (after changing APP_URL, or to clear an error). */
  reconnect: z.boolean().optional(),
});

export const PATCH = authed<{ id: string }>(
  async ({ req, params, workspace }) => {
    const input = await readJson(req, schema);
    const channel = await db.channel.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
    if (!channel) throw notFound("Channel");

    const data: { name?: string; status?: "ACTIVE" | "DISABLED" | "ERROR"; config?: object; lastError?: string | null } = {};
    if (input.name) data.name = input.name;
    if (input.status) data.status = input.status;
    if (input.widget && channel.type === "WEBCHAT") {
      data.config = { ...((channel.config ?? {}) as object), ...input.widget };
    }

    if (input.reconnect && channel.type === "TELEGRAM") {
      const token = channelCredentials(channel).token;
      try {
        await telegramSetWebhook(token, `${appUrl(req)}/api/webhooks/telegram/${channel.id}`, channel.webhookSecret);
        data.status = "ACTIVE";
        data.lastError = null;
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Could not register the webhook.");
      }
    }

    const updated = await db.channel.update({ where: { id: channel.id }, data });
    return { channel: serializeChannel(updated, appUrl(req)) };
  },
  { roles: MANAGERS },
);

export const DELETE = authed<{ id: string }>(
  async ({ params, workspace }) => {
    const channel = await db.channel.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
    if (!channel) throw notFound("Channel");
    if (channel.type === "WEBCHAT") throw new ApiError(400, "The website chat channel can't be removed.");

    if (channel.type === "TELEGRAM") {
      const token = channelCredentials(channel).token;
      if (token) await telegramDeleteWebhook(token).catch(() => undefined);
    }
    // Contacts and conversations of the channel are removed with it (cascade).
    await db.channel.delete({ where: { id: channel.id } });
    return { ok: true };
  },
  { roles: MANAGERS },
);
