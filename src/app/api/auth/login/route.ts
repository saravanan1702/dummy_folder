import { z } from "zod";
import { ApiError, clientIp, open, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

// Verified against when the email is unknown so response time doesn't reveal which emails exist.
let decoyHash: Promise<string> | null = null;

export const POST = open(
  async ({ req }) => {
    const input = await readJson(req, schema);
    await rateLimit(`login:ip:${clientIp(req)}`, 30, 900);
    await rateLimit(`login:email:${input.email}`, 10, 900);

    const user = await db.user.findUnique({ where: { email: input.email } });
    decoyHash ??= hashPassword("decoy-password");
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await decoyHash));
    if (!user || !ok) throw new ApiError(401, "Incorrect email or password.");

    await createSession(user.id, req.headers.get("user-agent"));
    return { ok: true };
  },
  { sameOrigin: true },
);
