import { z } from "zod";
import { ApiError, clientIp, open, readJson } from "@/lib/api";
import { hashPassword, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const POST = open(
  async ({ req }) => {
    await rateLimit(`reset:ip:${clientIp(req)}`, 20, 3600);
    const { token, password } = await readJson(req, schema);

    const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new ApiError(400, "This reset link has expired. Please request a new one.");
    }
    await db.$transaction([
      db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
      db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Sign out everywhere: a password reset usually means the old one leaked.
      db.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
    return { ok: true };
  },
  { sameOrigin: true },
);
