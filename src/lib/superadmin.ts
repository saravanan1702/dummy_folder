import { notFound } from "next/navigation";
import { ApiError } from "./api";
import { getAuth } from "./auth";

/** Platform owners, by email: SUPERADMIN_EMAILS="you@company.com,partner@company.com" */
export function isSuperadmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** For pages: 404 for everyone else, so the admin area isn't discoverable. */
export async function requireSuperadminPage() {
  const auth = await getAuth();
  if (!auth || !isSuperadmin(auth.user.email)) notFound();
  return auth;
}

export async function requireSuperadminApi() {
  const auth = await getAuth();
  if (!auth || !isSuperadmin(auth.user.email)) throw new ApiError(404, "Not found");
  return auth;
}
