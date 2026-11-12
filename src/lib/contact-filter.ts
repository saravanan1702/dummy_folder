import type { Prisma } from "@/generated/prisma/client";

/** Builds the contact list filter from query-string parameters (q, tag, channel, status). */
export function contactFilter(workspaceId: string, sp: URLSearchParams): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { workspaceId, isPreview: false };
  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  const tag = sp.get("tag");
  if (tag) where.tags = { some: { tagId: tag } };
  const channel = sp.get("channel");
  if (channel) where.channelId = channel;
  const status = sp.get("status");
  if (status === "SUBSCRIBED" || status === "UNSUBSCRIBED") where.status = status;
  return where;
}
