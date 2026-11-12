import { ChannelError, type InboundEvent, type OutboundMessage } from "./types";

const base = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelError("Could not reach Telegram. Please try again.");
  }
  const json = (await res.json().catch(() => null)) as TgResponse<T> | null;
  if (!json?.ok) {
    throw new ChannelError(json?.description ? `Telegram: ${json.description}` : `Telegram returned HTTP ${res.status}`);
  }
  return json.result as T;
}

export async function telegramGetMe(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, "getMe");
}

export async function telegramSetWebhook(token: string, url: string, secret: string) {
  await call(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
}

export async function telegramDeleteWebhook(token: string) {
  await call(token, "deleteWebhook", {});
}

export async function telegramSend(token: string, chatId: string, msg: OutboundMessage): Promise<{ externalId?: string }> {
  const rows: Record<string, string>[][] = [];
  for (const b of msg.buttons ?? []) {
    rows.push([b.url ? { text: b.label, url: b.url } : { text: b.label, callback_data: b.payload ?? "" }]);
  }
  // Quick replies are rendered as a compact row of inline buttons.
  const quick = (msg.quickReplies ?? []).map((q) => ({ text: q.label, callback_data: q.payload }));
  for (let i = 0; i < quick.length; i += 3) rows.push(quick.slice(i, i + 3));
  const reply_markup = rows.length ? { inline_keyboard: rows } : undefined;

  if (msg.kind === "image" && msg.imageUrl) {
    const sent = await call<{ message_id: number }>(token, "sendPhoto", {
      chat_id: chatId,
      photo: msg.imageUrl,
      caption: msg.text || undefined,
      reply_markup,
    });
    return { externalId: String(sent.message_id) };
  }
  const sent = await call<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: msg.text || "…",
    reply_markup,
    link_preview_options: { is_disabled: true },
  });
  return { externalId: String(sent.message_id) };
}

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: TgUser;
    chat: { id: number; type: string };
    text?: string;
    caption?: string;
    photo?: unknown[];
  };
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number; type: string };
      reply_markup?: { inline_keyboard?: { text: string; callback_data?: string }[][] };
    };
  };
}

const profileOf = (u?: TgUser) =>
  u
    ? { firstName: u.first_name ?? null, lastName: u.last_name ?? null, username: u.username ?? null, locale: u.language_code ?? null }
    : undefined;

/** Converts a Telegram update into normalized inbound events (private chats only). */
export function parseTelegramUpdate(update: TgUpdate): { events: InboundEvent[]; callbackQueryId?: string } {
  const events: InboundEvent[] = [];

  if (update.message && update.message.chat.type === "private") {
    const m = update.message;
    const common = {
      externalUserId: String(m.chat.id),
      externalMessageId: `m${m.message_id}`,
      profile: profileOf(m.from),
    };
    if (typeof m.text === "string") {
      const start = m.text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/);
      if (start) {
        events.push({ ...common, kind: "ref", text: "/start", ref: start[1] ?? "" });
      } else {
        events.push({ ...common, kind: "text", text: m.text });
      }
    } else if (m.photo) {
      events.push({ ...common, kind: "image", text: m.caption ?? "" });
    }
  }

  if (update.callback_query?.data && update.callback_query.message?.chat.type === "private") {
    const cq = update.callback_query;
    const label = cq.message?.reply_markup?.inline_keyboard
      ?.flat()
      .find((b) => b.callback_data === cq.data)?.text;
    events.push({
      externalUserId: String(cq.message!.chat.id),
      externalMessageId: `c${cq.id}`,
      kind: "postback",
      payload: cq.data,
      text: label ?? "",
      profile: profileOf(cq.from),
    });
    return { events, callbackQueryId: cq.id };
  }

  return { events };
}

export async function telegramAnswerCallback(token: string, callbackQueryId: string) {
  try {
    await call(token, "answerCallbackQuery", { callback_query_id: callbackQueryId });
  } catch {
    /* non-critical */
  }
}
