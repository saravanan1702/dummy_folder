import { after, NextResponse, type NextRequest } from "next/server";
import { channelCredentials } from "@/lib/channels";
import { parseTelegramUpdate, telegramAnswerCallback } from "@/lib/channels/telegram";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { handleInbound } from "@/lib/engine/inbound";

export async function POST(req: NextRequest, ctx: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await ctx.params;
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.type !== "TELEGRAM") return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Telegram echoes the secret we registered with setWebhook in this header.
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(secret, channel.webhookSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (channel.status === "DISABLED") return NextResponse.json({ ok: true });

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  const { events, callbackQueryId } = parseTelegramUpdate(update);

  // Acknowledge right away; Telegram retries slow webhooks.
  after(async () => {
    try {
      if (callbackQueryId) {
        const token = channelCredentials(channel).token;
        if (token) await telegramAnswerCallback(token, callbackQueryId);
      }
      for (const event of events) await handleInbound(channel, event);
    } catch (err) {
      console.error(`[telegram ${channel.id}] failed to process update`, err);
    }
  });
  return NextResponse.json({ ok: true });
}
