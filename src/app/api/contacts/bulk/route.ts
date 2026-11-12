import { z } from "zod";
import { authed, badRequest, notFound, readJson } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(500),
  action: z.enum(["add_tag", "remove_tag", "delete", "subscribe", "unsubscribe"]),
  tagId: z.string().max(40).optional(),
});

export const POST = authed(async ({ req, workspace }) => {
  const { ids, action, tagId } = await readJson(req, schema);
  // Resolve ids inside the workspace first so foreign ids are silently ignored.
  const contacts = await db.contact.findMany({
    where: { workspaceId: workspace.id, id: { in: ids } },
    select: { id: true },
  });
  const scoped = contacts.map((c) => c.id);

  if (action === "add_tag" || action === "remove_tag") {
    if (!tagId) throw badRequest("Choose a tag");
    const tag = await db.tag.findFirst({ where: { id: tagId, workspaceId: workspace.id } });
    if (!tag) throw notFound("Tag");
    if (action === "add_tag") {
      await db.contactTag.createMany({
        data: scoped.map((contactId) => ({ contactId, tagId: tag.id })),
        skipDuplicates: true,
      });
    } else {
      await db.contactTag.deleteMany({ where: { tagId: tag.id, contactId: { in: scoped } } });
    }
  } else if (action === "delete") {
    await db.contact.deleteMany({ where: { id: { in: scoped } } });
  } else {
    await db.contact.updateMany({
      where: { id: { in: scoped } },
      data: { status: action === "subscribe" ? "SUBSCRIBED" : "UNSUBSCRIBED" },
    });
  }
  return { affected: scoped.length };
});
