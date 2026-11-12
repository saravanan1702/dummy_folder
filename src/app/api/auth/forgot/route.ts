import { z } from "zod";
import { brand } from "@/config/brand";
import { clientIp, open, readJson } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { sendMail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export const POST = open(
  async ({ req }) => {
    const { email } = await readJson(req, schema);
    await rateLimit(`forgot:ip:${clientIp(req)}`, 10, 3600);
    await rateLimit(`forgot:email:${email}`, 3, 3600);

    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = randomToken(32);
      await db.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) },
      });
      await sendMail({
        to: user.email,
        subject: `Reset your ${brand.name} password`,
        text: `Hi ${user.name},\n\nUse the link below to choose a new password. It expires in one hour.\n\n${appUrl(req)}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    }
    // Same answer either way so the endpoint can't be used to discover accounts.
    return { ok: true };
  },
  { sameOrigin: true },
);
