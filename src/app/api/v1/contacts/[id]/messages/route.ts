import { z } from "zod";
import { ApiError, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { deliver } from "@/lib/engine/deliver";
import { withApiKey } from "@/lib/public-api";

const schema = z.object({ text: z.string().trim().min(1).max(2000) });

/** POST /api/v1/contacts/:id/messages  { "text": "Your order has shipped" } */
export const POST = withApiKey<{ id: string }>(async ({ req, params, workspace }) => {
  const { text } = await readJson(req, schema);
  const contact = await db.contact.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: { channel: true },
  });
  if (!contact) throw notFound("Contact");

  const conversation = await db.conversation.upsert({
    where: { contactId: contact.id },
    update: {},
    create: { workspaceId: workspace.id, contactId: contact.id, channelId: contact.channelId },
  });
  const message = await deliver({
    workspaceId: workspace.id,
    conversationId: conversation.id,
    contact,
    channel: contact.channel,
    message: { kind: "text", text },
    senderType: "BOT",
  });
  if (message.status === "FAILED") throw new ApiError(502, message.error ?? "The message could not be delivered");
  return { id: message.id, status: "sent" };
});
