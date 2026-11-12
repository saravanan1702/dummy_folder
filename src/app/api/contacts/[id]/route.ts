import { z } from "zod";
import { authed, notFound, readJson } from "@/lib/api";
import { FIELD_KEY_RE } from "@/lib/contacts";
import { db } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

const include = {
  tags: { include: { tag: { select: { id: true, name: true } } } },
  channel: { select: { id: true, type: true, name: true } },
} as const;

export const GET = authed<{ id: string }>(async ({ params, workspace }) => {
  const contact = await db.contact.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: { ...include, conversation: { select: { id: true } } },
  });
  if (!contact) throw notFound("Contact");
  return { contact: { ...serializeContact(contact), conversationId: contact.conversation?.id ?? null } };
});

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const schema = z.object({
  firstName: nullableText(100).optional(),
  lastName: nullableText(100).optional(),
  email: nullableText(200).optional(),
  phone: nullableText(40).optional(),
  status: z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]).optional(),
  fields: z.record(z.string().regex(FIELD_KEY_RE), z.string().max(1000)).optional(),
  tagIds: z.array(z.string().max(40)).max(100).optional(),
});

export const PATCH = authed<{ id: string }>(async ({ req, params, workspace }) => {
  const input = await readJson(req, schema);
  const contact = await db.contact.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!contact) throw notFound("Contact");

  const { tagIds, fields, ...scalars } = input;
  let nextFields: Record<string, string> | undefined;
  if (fields) {
    nextFields = { ...((contact.fields ?? {}) as Record<string, string>) };
    for (const [key, value] of Object.entries(fields)) {
      if (value === "") delete nextFields[key];
      else nextFields[key] = value;
    }
  }

  await db.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contact.id }, data: { ...scalars, fields: nextFields } });
    if (tagIds) {
      // Only tags from this workspace can be attached.
      const valid = await tx.tag.findMany({ where: { workspaceId: workspace.id, id: { in: tagIds } }, select: { id: true } });
      await tx.contactTag.deleteMany({ where: { contactId: contact.id, tagId: { notIn: valid.map((t) => t.id) } } });
      await tx.contactTag.createMany({
        data: valid.map((t) => ({ contactId: contact.id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  });

  const fresh = await db.contact.findUniqueOrThrow({ where: { id: contact.id }, include });
  return { contact: serializeContact(fresh) };
});

export const DELETE = authed<{ id: string }>(async ({ params, workspace }) => {
  const res = await db.contact.deleteMany({ where: { id: params.id, workspaceId: workspace.id } });
  if (res.count === 0) throw notFound("Contact");
  return { ok: true };
});
