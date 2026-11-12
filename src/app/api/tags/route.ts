import { z } from "zod";
import { ApiError, authed, readJson } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = authed(async ({ workspace }) => {
  const tags = await db.tag.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  return { tags: tags.map((t) => ({ id: t.id, name: t.name, contacts: t._count.contacts, createdAt: t.createdAt })) };
});

const schema = z.object({ name: z.string().trim().min(1, "Enter a tag name").max(50) });

export const POST = authed(async ({ req, workspace }) => {
  const { name } = await readJson(req, schema);
  const count = await db.tag.count({ where: { workspaceId: workspace.id } });
  if (count >= 500) throw new ApiError(400, "You have reached the maximum number of tags.");
  const tag = await db.tag.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name } },
    update: {},
    create: { workspaceId: workspace.id, name },
  });
  return { tag: { id: tag.id, name: tag.name, contacts: 0, createdAt: tag.createdAt } };
});
