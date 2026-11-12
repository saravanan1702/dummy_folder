import type { ChannelType } from "@/generated/prisma/client";

export interface OutboundButton {
  label: string;
  /** Postback payload (click continues a flow). Mutually exclusive with url. */
  payload?: string;
  url?: string;
}

export interface OutboundQuickReply {
  label: string;
  payload: string;
}

export interface OutboundMessage {
  kind: "text" | "image";
  text?: string;
  imageUrl?: string;
  buttons?: OutboundButton[];
  quickReplies?: OutboundQuickReply[];
}

export interface ContactProfile {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
}

export interface InboundEvent {
  externalUserId: string;
  kind: "text" | "postback" | "image" | "ref";
  text?: string;
  /** Postback payload for button / quick-reply clicks. */
  payload?: string;
  /** Deep-link reference (t.me/bot?start=ref, m.me/page?ref=ref). */
  ref?: string;
  imageUrl?: string;
  externalMessageId?: string;
  profile?: ContactProfile;
}

export interface ChannelTarget {
  type: ChannelType;
  externalId: string | null;
  credentials: Record<string, string>;
}

export class ChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelError";
  }
}

export const CHANNEL_LABEL: Record<ChannelType, string> = {
  WEBCHAT: "Website Chat",
  TELEGRAM: "Telegram",
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram",
};

/** Channels where free-form messages are only allowed within 24h of the contact's last message. */
export const WINDOWED_CHANNELS: ChannelType[] = ["WHATSAPP", "MESSENGER", "INSTAGRAM"];
