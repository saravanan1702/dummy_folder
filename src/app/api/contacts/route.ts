import { authed, pageParams } from "@/lib/api";
import { contactFilter } from "@/lib/contact-filter";
import { db } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

export const GET = authed(async ({ req, workspace }) => {
  const { page, size, skip, take } = pageParams(req, 25, 100);
  const where = contactFilter(workspace.id, req.nextUrl.searchParams);
  const [total, rows] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        tags: { include: { tag: { select: { id: true, name: true } } } },
        channel: { select: { id: true, type: true, name: true } },
      },
    }),
  ]);
  return { total, page, size, contacts: rows.map(serializeContact) };
});
