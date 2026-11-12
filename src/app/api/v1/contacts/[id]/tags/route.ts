import { z } from "zod";
import { notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/public-api";

const schema = z.object({ tag: z.string().trim().min(1).max(50) });

/** POST /api/v1/contacts/:id/tags  { "tag": "Customer" } – adds a tag, creating it if needed. */
export const POST = withApiKey<{ id: string }>(async ({ req, params, workspace }) => {
  const { tag: name } = await readJson(req, schema);
  const contact = await db.contact.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!contact) throw notFound("Contact");
  const tag = await db.tag.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name } },
    update: {},
    create: { workspaceId: workspace.id, name },
  });
  await db.contactTag.createMany({ data: [{ contactId: contact.id, tagId: tag.id }], skipDuplicates: true });
  return { ok: true };
});

/** DELETE /api/v1/contacts/:id/tags?tag=Customer */
export const DELETE = withApiKey<{ id: string }>(async ({ req, params, workspace }) => {
  const name = req.nextUrl.searchParams.get("tag") ?? "";
  const contact = await db.contact.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!contact) throw notFound("Contact");
  await db.contactTag.deleteMany({
    where: { contactId: contact.id, tag: { workspaceId: workspace.id, name } },
  });
  return { ok: true };
});
