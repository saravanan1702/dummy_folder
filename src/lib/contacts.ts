/** Pure helpers shared by server and client code. */

export interface NameParts {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  externalId?: string | null;
}

export function contactName(c: NameParts): string {
  const full = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (c.username) return `@${c.username}`;
  const tail = (c.externalId ?? "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
  return tail ? `Visitor ${tail}` : "Visitor";
}

export function initials(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const SYSTEM_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELDS)[number]["key"];

export function isSystemField(key: string): key is SystemFieldKey {
  return SYSTEM_FIELDS.some((f) => f.key === key);
}

export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** Derives a stable snake_case key from a human field label. */
export function keyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : `f_${key}`.slice(0, 40);
}
