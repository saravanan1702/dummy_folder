import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, authed, readJson } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";
import { hashPassword, sha256, verifyPassword } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export const POST = authed(async ({ req, user }) => {
  await rateLimit(`pwchange:${user.id}`, 10, 900);
  const { current, next } = await readJson(req, schema);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) {
    throw new ApiError(400, "Your current password is incorrect.");
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }),
    // Keep this device signed in, sign out all others.
    db.session.deleteMany({ where: { userId: user.id, tokenHash: { not: sha256(token) } } }),
  ]);
  return { ok: true };
});
