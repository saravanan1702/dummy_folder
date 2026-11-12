import type { Channel } from "@/generated/prisma/client";
import { decryptJson } from "../crypto";
import { pageSend, whatsappSend } from "./meta";
import { telegramSend } from "./telegram";
import { ChannelError, type OutboundMessage } from "./types";

export * from "./types";

export function channelCredentials(channel: Pick<Channel, "credentials">): Record<string, string> {
  return decryptJson<Record<string, string>>(channel.credentials) ?? {};
}

/**
 * Pushes a message to the contact through the channel's provider.
 * Website chat has no push step – the widget reads messages from the database.
 */
export async function sendViaChannel(
  channel: Pick<Channel, "type" | "externalId" | "credentials" | "status">,
  recipientExternalId: string,
  msg: OutboundMessage,
): Promise<{ externalId?: string }> {
  if (channel.type === "WEBCHAT") return {};
  if (channel.status === "DISABLED") throw new ChannelError("This channel is disconnected.");

  const creds = channelCredentials(channel);
  switch (channel.type) {
    case "TELEGRAM":
      if (!creds.token) throw new ChannelError("Telegram bot token is missing.");
      return telegramSend(creds.token, recipientExternalId, msg);
    case "WHATSAPP":
      if (!creds.token || !channel.externalId) throw new ChannelError("WhatsApp credentials are missing.");
      return whatsappSend(channel.externalId, creds.token, recipientExternalId, msg);
    case "MESSENGER":
    case "INSTAGRAM":
      if (!creds.token) throw new ChannelError("Page access token is missing.");
      return pageSend(creds.token, recipientExternalId, msg);
    default:
      throw new ChannelError("Unsupported channel.");
  }
}
