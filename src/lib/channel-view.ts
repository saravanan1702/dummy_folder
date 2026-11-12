import type { Channel } from "@/generated/prisma/client";

/** Public view of a channel. Credentials never leave the server. */
export function serializeChannel(channel: Channel, baseUrl: string, contacts = 0) {
  const meta = channel.type === "WHATSAPP" || channel.type === "MESSENGER" || channel.type === "INSTAGRAM";
  return {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    status: channel.status,
    externalId: channel.externalId,
    config: (channel.config ?? {}) as Record<string, string>,
    lastError: channel.lastError,
    contacts,
    createdAt: channel.createdAt,
    // Shown once the channel exists so the customer can paste them into their Meta app.
    webhook: meta
      ? { url: `${baseUrl}/api/webhooks/meta/${channel.id}`, verifyToken: channel.webhookSecret }
      : null,
  };
}
export type ChannelDTO = ReturnType<typeof serializeChannel>;
