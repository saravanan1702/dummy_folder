/**
 * Meta platforms: WhatsApp Cloud API, Messenger and Instagram messaging.
 * Each workspace connects its own Meta app ("bring your own app"): it pastes an
 * access token + app secret and points the app's webhook at the per-channel URL.
 */
import { ChannelError, type ContactProfile, type InboundEvent, type OutboundMessage } from "./types";

const graphBase = () =>
  `${(process.env.META_GRAPH_BASE || "https://graph.facebook.com").replace(/\/+$/, "")}/${process.env.META_GRAPH_VERSION || "v24.0"}`;

interface GraphError {
  error?: { message?: string; code?: number };
}

async function graph<T>(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${graphBase()}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelError("Could not reach Meta. Please try again.");
  }
  const json = (await res.json().catch(() => null)) as (T & GraphError) | null;
  if (!res.ok || !json || json.error) {
    throw new ChannelError(json?.error?.message ? `Meta: ${json.error.message}` : `Meta returned HTTP ${res.status}`);
  }
  return json;
}

// ── WhatsApp Cloud API ────────────────────────────────────────────────

export async function whatsappVerify(phoneNumberId: string, token: string) {
  return graph<{ id: string; display_phone_number?: string; verified_name?: string }>(
    `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
    token,
  );
}

export async function whatsappSend(
  phoneNumberId: string,
  token: string,
  to: string,
  msg: OutboundMessage,
): Promise<{ externalId?: string }> {
  const baseBody = { messaging_product: "whatsapp", recipient_type: "individual", to };
  let body: Record<string, unknown>;

  // WhatsApp has no URL buttons in session messages – links are appended to the text.
  const links = (msg.buttons ?? []).filter((b) => b.url);
  const replies = [
    ...(msg.buttons ?? []).filter((b) => !b.url).map((b) => ({ label: b.label, payload: b.payload ?? "" })),
    ...(msg.quickReplies ?? []),
  ];
  const text = [msg.text ?? "", ...links.map((l) => `${l.label}: ${l.url}`)].filter(Boolean).join("\n\n") || "…";

  if (msg.kind === "image" && msg.imageUrl) {
    body = { ...baseBody, type: "image", image: { link: msg.imageUrl, caption: msg.text || undefined } };
  } else if (replies.length > 0 && replies.length <= 3) {
    body = {
      ...baseBody,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: text.slice(0, 1024) },
        action: {
          buttons: replies.map((r) => ({ type: "reply", reply: { id: r.payload, title: r.label.slice(0, 20) } })),
        },
      },
    };
  } else if (replies.length > 3) {
    body = {
      ...baseBody,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: text.slice(0, 1024) },
        action: {
          button: "Choose",
          sections: [{ title: "Options", rows: replies.slice(0, 10).map((r) => ({ id: r.payload, title: r.label.slice(0, 24) })) }],
        },
      },
    };
  } else {
    body = { ...baseBody, type: "text", text: { body: text.slice(0, 4096), preview_url: false } };
  }

  const res = await graph<{ messages?: { id: string }[] }>(`/${encodeURIComponent(phoneNumberId)}/messages`, token, {
    method: "POST",
    body,
  });
  return { externalId: res.messages?.[0]?.id };
}

interface WaWebhook {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          image?: { caption?: string };
          button?: { payload?: string; text?: string };
          interactive?: {
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
          };
        }[];
      };
    }[];
  }[];
}

export function parseWhatsappWebhook(body: WaWebhook): InboundEvent[] {
  const events: InboundEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      for (const m of value.messages) {
        const who = value.contacts?.find((c) => c.wa_id === m.from);
        const [firstName, ...rest] = (who?.profile?.name ?? "").trim().split(/\s+/);
        const profile: ContactProfile = {
          firstName: firstName || null,
          lastName: rest.join(" ") || null,
          phone: `+${m.from}`,
        };
        const common = { externalUserId: m.from, externalMessageId: m.id, profile };
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
        if (m.type === "text" && m.text) {
          events.push({ ...common, kind: "text", text: m.text.body });
        } else if (m.type === "interactive" && reply) {
          events.push({ ...common, kind: "postback", payload: reply.id, text: reply.title });
        } else if (m.type === "button" && m.button) {
          events.push({ ...common, kind: "text", text: m.button.text ?? m.button.payload ?? "" });
        } else if (m.type === "image") {
          events.push({ ...common, kind: "image", text: m.image?.caption ?? "" });
        } else {
          events.push({ ...common, kind: "text", text: `[${m.type}]` });
        }
      }
    }
  }
  return events;
}

// ── Messenger & Instagram (Send API with a Page access token) ─────────

export async function pageVerify(token: string) {
  return graph<{ id: string; name?: string; instagram_business_account?: { id: string; username?: string } }>(
    `/me?fields=id,name,instagram_business_account{id,username}`,
    token,
  );
}

export async function pageSend(token: string, recipientId: string, msg: OutboundMessage): Promise<{ externalId?: string }> {
  let message: Record<string, unknown>;
  const quick = (msg.quickReplies ?? []).slice(0, 13).map((q) => ({
    content_type: "text",
    title: q.label.slice(0, 20),
    payload: q.payload,
  }));

  if (msg.kind === "image" && msg.imageUrl) {
    message = { attachment: { type: "image", payload: { url: msg.imageUrl, is_reusable: true } } };
  } else if (msg.buttons?.length) {
    message = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: (msg.text || "…").slice(0, 640),
          buttons: msg.buttons.slice(0, 3).map((b) =>
            b.url
              ? { type: "web_url", title: b.label.slice(0, 20), url: b.url }
              : { type: "postback", title: b.label.slice(0, 20), payload: b.payload ?? "" },
          ),
        },
      },
    };
  } else {
    message = { text: (msg.text || "…").slice(0, 2000) };
  }
  if (quick.length) message.quick_replies = quick;

  const res = await graph<{ message_id?: string }>(`/me/messages`, token, {
    method: "POST",
    body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message },
  });
  return { externalId: res.message_id };
}

export async function pageProfile(token: string, userId: string, instagram: boolean): Promise<ContactProfile | undefined> {
  try {
    if (instagram) {
      const p = await graph<{ name?: string; username?: string; profile_pic?: string }>(
        `/${encodeURIComponent(userId)}?fields=name,username,profile_pic`,
        token,
      );
      const [firstName, ...rest] = (p.name ?? "").trim().split(/\s+/);
      return { firstName: firstName || null, lastName: rest.join(" ") || null, username: p.username ?? null, avatarUrl: p.profile_pic ?? null };
    }
    const p = await graph<{ first_name?: string; last_name?: string; profile_pic?: string }>(
      `/${encodeURIComponent(userId)}?fields=first_name,last_name,profile_pic`,
      token,
    );
    return { firstName: p.first_name ?? null, lastName: p.last_name ?? null, avatarUrl: p.profile_pic ?? null };
  } catch {
    return undefined; // profile access requires extra permissions; never block messaging on it
  }
}

interface PageWebhook {
  object?: string;
  entry?: {
    messaging?: {
      sender?: { id: string };
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        quick_reply?: { payload: string };
        attachments?: { type: string; payload?: { url?: string } }[];
      };
      postback?: { mid?: string; title?: string; payload?: string; referral?: { ref?: string } };
      referral?: { ref?: string };
    }[];
  }[];
}

export function parsePageWebhook(body: PageWebhook): InboundEvent[] {
  const events: InboundEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const sender = m.sender?.id;
      if (!sender) continue;
      if (m.message) {
        if (m.message.is_echo) continue;
        const common = { externalUserId: sender, externalMessageId: m.message.mid };
        if (m.message.quick_reply?.payload) {
          events.push({ ...common, kind: "postback", payload: m.message.quick_reply.payload, text: m.message.text ?? "" });
        } else if (typeof m.message.text === "string") {
          events.push({ ...common, kind: "text", text: m.message.text });
        } else if (m.message.attachments?.length) {
          const image = m.message.attachments.find((a) => a.type === "image");
          events.push({ ...common, kind: "image", text: "", imageUrl: image?.payload?.url });
        }
      } else if (m.postback) {
        const common = { externalUserId: sender, externalMessageId: m.postback.mid };
        if (m.postback.referral?.ref) {
          events.push({ ...common, kind: "ref", ref: m.postback.referral.ref, text: m.postback.title ?? "Get started" });
        } else {
          events.push({ ...common, kind: "postback", payload: m.postback.payload ?? "", text: m.postback.title ?? "" });
        }
      } else if (m.referral?.ref) {
        events.push({ externalUserId: sender, kind: "ref", ref: m.referral.ref, text: "" });
      }
    }
  }
  return events;
}
