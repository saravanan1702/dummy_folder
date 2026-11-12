import { z } from "zod";
import { ApiError, authed, MANAGERS, readJson } from "@/lib/api";
import { FIELD_KEY_RE, isSystemField, keyFromLabel } from "@/lib/contacts";
import { db } from "@/lib/db";

export const GET = authed(async ({ workspace }) => {
  const fields = await db.customField.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" } });
  return { fields: fields.map((f) => ({ id: f.id, key: f.key, label: f.label, type: f.type })) };
});

const schema = z.object({
  label: z.string().trim().min(1, "Enter a field name").max(60),
  type: z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE"]).default("TEXT"),
});

export const POST = authed(
  async ({ req, workspace }) => {
    const { label, type } = await readJson(req, schema);
    const key = keyFromLabel(label);
    if (!FIELD_KEY_RE.test(key) || isSystemField(key) || ["name", "full_name", "username"].includes(key)) {
      throw new ApiError(400, "That name is reserved. Please choose a different field name.");
    }
    const count = await db.customField.count({ where: { workspaceId: workspace.id } });
    if (count >= 100) throw new ApiError(400, "You've reached the maximum number of custom fields.");
    const field = await db.customField.create({ data: { workspaceId: workspace.id, key, label, type } });
    return { field: { id: field.id, key: field.key, label: field.label, type: field.type } };
  },
  { roles: MANAGERS },
);
