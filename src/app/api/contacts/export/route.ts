import { authed } from "@/lib/api";
import { contactName } from "@/lib/contacts";
import { db } from "@/lib/db";
import { contactFilter } from "@/lib/contact-filter";

function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET = authed(async ({ req, workspace }) => {
  const where = contactFilter(workspace.id, req.nextUrl.searchParams);
  const [fields, contacts] = await Promise.all([
    db.customField.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" } }),
    db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50_000,
      include: { tags: { include: { tag: true } }, channel: { select: { type: true } } },
    }),
  ]);

  const header = ["Name", "First name", "Last name", "Email", "Phone", "Username", "Channel", "Status", "Tags", "Subscribed at", ...fields.map((f) => f.label)];
  const lines = [header.map(cell).join(",")];
  for (const c of contacts) {
    const values = (c.fields ?? {}) as Record<string, unknown>;
    lines.push(
      [
        contactName(c),
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.username,
        c.channel.type.toLowerCase(),
        c.status.toLowerCase(),
        c.tags.map((t) => t.tag.name).join("; "),
        c.createdAt.toISOString(),
        ...fields.map((f) => values[f.key]),
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
