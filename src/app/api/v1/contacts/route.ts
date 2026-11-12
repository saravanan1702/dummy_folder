import type { Prisma } from "@/generated/prisma/client";
import { pageParams } from "@/lib/api";
import { db } from "@/lib/db";
import { publicContact, publicContactInclude, withApiKey } from "@/lib/public-api";

/** GET /api/v1/contacts?email=&phone=&tag=&page=&size= */
export const GET = withApiKey(async ({ req, workspace }) => {
  const sp = req.nextUrl.searchParams;
  const { page, size, skip, take } = pageParams(req, 50, 100);
  const where: Prisma.ContactWhereInput = { workspaceId: workspace.id, isPreview: false };
  const email = sp.get("email");
  if (email) where.email = { equals: email, mode: "insensitive" };
  const phone = sp.get("phone");
  if (phone) where.phone = phone;
  const tag = sp.get("tag");
  if (tag) where.tags = { some: { tag: { name: tag } } };

  const [total, rows] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: publicContactInclude }),
  ]);
  return { total, page, size, data: rows.map(publicContact) };
});
