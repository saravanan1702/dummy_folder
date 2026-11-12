import { after, NextResponse, type NextRequest } from "next/server";
import { channelCredentials, type InboundEvent } from "@/lib/channels";
import { pageProfile, parsePageWebhook, parseWhatsappWebhook } from "@/lib/channels/meta";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { handleInbound } from "@/lib/engine/inbound";

type Ctx = { params: Promise<{ channelId: string }> };

async function loadChannel(channelId: string) {
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel) return null;
  if (channel.type !== "WHATSAPP" && channel.type !== "MESSENGER" && channel.type !== "INSTAGRAM") return null;
  return channel;
}

/** Webhook verification handshake (Meta app dashboard → "Verify and save"). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { channelId } = await ctx.params;
  const channel = await loadChannel(channelId);
  const sp = req.nextUrl.searchParams;
  if (
    channel &&
    sp.get("hub.mode") === "subscribe" &&
    safeEqual(sp.get("hub.verify_token") ?? "", channel.webhookSecret)
  ) {
    return new Response(sp.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { channelId } = await ctx.params;
  const channel = await loadChannel(channelId);
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every delivery is signed with the app secret; reject anything we can't authenticate.
  const raw = await req.text();
  const creds = channelCredentials(channel);
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!creds.appSecret || !safeEqual(signature, `sha256=${hmacSha256Hex(creds.appSecret, raw)}`)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  if (channel.status === "DISABLED") return NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  let events: InboundEvent[] = [];
  if (channel.type === "WHATSAPP") {
    // One Meta app can serve several numbers; only accept events for this channel's number.
    const scoped = body as { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[] };
    const mine = (scoped.entry ?? []).every((e) =>
      (e.changes ?? []).every((c) => !c.value?.metadata?.phone_number_id || c.value.metadata.phone_number_id === channel.externalId),
    );
    if (mine) events = parseWhatsappWebhook(body as Parameters<typeof parseWhatsappWebhook>[0]);
  } else {
    events = parsePageWebhook(body as Parameters<typeof parsePageWebhook>[0]);
  }

  after(async () => {
    try {
      for (const event of events) {
        if (channel.type !== "WHATSAPP" && creds.token) {
          // Messenger / Instagram webhooks carry no names; look the profile up once for new contacts.
          const known = await db.contact.findUnique({
            where: { channelId_externalId: { channelId: channel.id, externalId: event.externalUserId } },
            select: { id: true },
          });
          if (!known) event.profile = await pageProfile(creds.token, event.externalUserId, channel.type === "INSTAGRAM");
        }
        await handleInbound(channel, event);
      }
    } catch (err) {
      console.error(`[meta ${channel.id}] failed to process webhook`, err);
    }
  });
  return NextResponse.json({ ok: true });
}
