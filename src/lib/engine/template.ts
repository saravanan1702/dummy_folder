import { contactName } from "../contacts";

export interface TemplateContact {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  externalId: string;
  fields: unknown;
}

export function contactVariables(c: TemplateContact): Record<string, string> {
  const fields = (c.fields && typeof c.fields === "object" ? c.fields : {}) as Record<string, unknown>;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined && v !== "") vars[k] = String(v);
  }
  if (c.firstName) vars.first_name = c.firstName;
  if (c.lastName) vars.last_name = c.lastName;
  if (c.email) vars.email = c.email;
  if (c.phone) vars.phone = c.phone;
  if (c.username) vars.username = c.username;
  const full = [c.firstName, c.lastName].filter(Boolean).join(" ");
  if (full) vars.full_name = full;
  vars.name = contactName(c);
  return vars;
}

/**
 * Replaces {{variable}} and {{variable|fallback}} placeholders.
 * Unknown variables without a fallback render as an empty string.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g, (_, key: string, fallback?: string) => {
    const value = vars[key.toLowerCase()] ?? vars[key];
    if (value !== undefined && value !== "") return value;
    return fallback?.trim() ?? "";
  });
}
