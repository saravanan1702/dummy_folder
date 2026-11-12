/**
 * Demo data: `npm run db:seed`
 * Creates demo@example.com / demo12345 with a workspace, tags, contacts and conversations.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/crypto";
import { createWorkspace, installTemplate } from "../src/lib/workspace";

async function main() {
  const email = "demo@example.com";
  if (await db.user.findUnique({ where: { email } })) {
    console.log("Demo user already exists – nothing to do.");
    return;
  }
  const user = await db.user.create({ data: { email, name: "Demo Owner", passwordHash: await hashPassword("demo12345") } });
  const ws = await createWorkspace(user.id, "Demo Store");
  await installTemplate(ws.id, "lead-capture", { publish: true, withKeywords: true });
  await installTemplate(ws.id, "faq-menu", { publish: true, withKeywords: true });
  const channel = await db.channel.findFirstOrThrow({ where: { workspaceId: ws.id, type: "WEBCHAT" } });
  const vip = await db.tag.create({ data: { workspaceId: ws.id, name: "VIP" } });
  const lead = await db.tag.findFirstOrThrow({ where: { workspaceId: ws.id, name: "Lead" } });

  const people = [
    ["Maya", "Chen", "maya@example.com"],
    ["Liam", "Okafor", null],
    ["Sofia", "Rossi", "sofia@example.com"],
    ["Noah", "Patel", null],
    ["Ava", "Kim", "ava@example.com"],
  ] as const;
  for (let i = 0; i < 40; i++) {
    const [firstName, lastName, mail] = people[i % people.length];
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 28) * 86_400_000);
    const contact = await db.contact.create({
      data: {
        workspaceId: ws.id, channelId: channel.id, externalId: `demo-${i}`,
        firstName, lastName: `${lastName}${i >= people.length ? ` ${i}` : ""}`, email: mail,
        createdAt, lastInboundAt: createdAt, source: "webchat",
        tags: { create: i % 3 === 0 ? [{ tagId: lead.id }] : i % 7 === 0 ? [{ tagId: vip.id }] : [] },
      },
    });
    const open = i < 4;
    const convo = await db.conversation.create({
      data: { workspaceId: ws.id, contactId: contact.id, channelId: channel.id, status: open ? "OPEN" : "CLOSED",
        unreadCount: open ? 1 : 0, lastMessageAt: createdAt, lastPreview: open ? "Can I speak to someone?" : "Thanks!" },
    });
    await db.message.createMany({
      data: [
        { workspaceId: ws.id, conversationId: convo.id, contactId: contact.id, direction: "IN", senderType: "CONTACT", text: "Hi!", status: "RECEIVED", createdAt },
        { workspaceId: ws.id, conversationId: convo.id, contactId: contact.id, direction: "OUT", senderType: "BOT", text: `Hi ${firstName}! 👋 How can I help?`, createdAt: new Date(createdAt.getTime() + 1000) },
        { workspaceId: ws.id, conversationId: convo.id, contactId: contact.id, direction: "IN", senderType: "CONTACT", text: open ? "Can I speak to someone?" : "Thanks!", status: "RECEIVED", createdAt: new Date(createdAt.getTime() + 60_000) },
      ],
    });
  }
  console.log("Seeded. Sign in with demo@example.com / demo12345");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
