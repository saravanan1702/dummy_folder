import { z } from "zod";
import { db } from "./db";
import type { Audience } from "./engine/broadcast";

const ids = z.array(z.string().max(40)).max(50).default([]);

export const audienceSchema = z.object({
  channelIds: ids,
  tagIds: ids,
  tagMatch: z.enum(["any", "all"]).default("any"),
  excludeTagIds: ids,
});

/** Drops any channel / tag ids that don't belong to the workspace. */
export async function scopeAudience(workspaceId: string, input: z.infer<typeof audienceSchema>): Promise<Required<Audience>> {
  const [channels, tags] = await Promise.all([
    db.channel.findMany({ where: { workspaceId, id: { in: input.channelIds } }, select: { id: true } }),
    db.tag.findMany({
      where: { workspaceId, id: { in: [...input.tagIds, ...input.excludeTagIds] } },
      select: { id: true },
    }),
  ]);
  const tagSet = new Set(tags.map((t) => t.id));
  return {
    channelIds: channels.map((c) => c.id),
    tagIds: input.tagIds.filter((id) => tagSet.has(id)),
    tagMatch: input.tagMatch,
    excludeTagIds: input.excludeTagIds.filter((id) => tagSet.has(id)),
  };
}
