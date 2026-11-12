import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { isProd } from "./env";
import type { Membership, User, Workspace } from "@/generated/prisma/client";

export const SESSION_COOKIE = "cv_session";
export const WORKSPACE_COOKIE = "cv_ws";
const SESSION_DAYS = 30;

function cookieSecure() {
  const url = process.env.APP_URL;
  if (url) return url.startsWith("https://");
  return isProd;
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 250) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
}

export async function setActiveWorkspace(workspaceId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}

export interface AuthContext {
  user: Pick<User, "id" | "email" | "name">;
  workspace: Workspace;
  membership: Membership;
  /** All workspaces the user belongs to (for the switcher). */
  workspaces: { id: string; name: string; role: Membership["role"] }[];
}

/** Resolves the signed-in user and their active workspace, or null. Cached per request. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const memberships = session.user.memberships;
  if (memberships.length === 0) return null;

  const preferred = jar.get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspaceId === preferred) ?? memberships[0];
  const { workspace, ...membership } = active;

  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    workspace,
    membership,
    workspaces: memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name, role: m.role })),
  };
});

/** For server components: returns the auth context or redirects to the login page. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

export function canManage(role: Membership["role"]) {
  return role === "OWNER" || role === "ADMIN";
}
