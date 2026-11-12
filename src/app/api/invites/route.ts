import { z } from "zod";
import { brand } from "@/config/brand";
import { ApiError, authed, MANAGERS, readJson } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { sendMail } from "@/lib/mailer";
import { assertWithinLimit } from "@/lib/workspace";

export const GET = authed(
  async ({ workspace }) => {
    const invites = await db.invite.findMany({
      where: { workspaceId: workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    return { invites };
  },
  { roles: MANAGERS },
);

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["ADMIN", "AGENT"]),
});

export const POST = authed(
  async ({ req, workspace, user }) => {
    const { email, role } = await readJson(req, schema);

    const member = await db.membership.findFirst({ where: { workspaceId: workspace.id, user: { email } } });
    if (member) throw new ApiError(409, "That person is already on your team.");

    const pending = await db.invite.count({
      where: { workspaceId: workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    await assertWithinLimit(workspace, "seats", pending + 1);

    const token = randomToken(32);
    await db.invite.deleteMany({ where: { workspaceId: workspace.id, email, acceptedAt: null } });
    const invite = await db.invite.create({
      data: {
        workspaceId: workspace.id,
        email,
        role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    const link = `${appUrl(req)}/invite/${token}`;
    await sendMail({
      to: email,
      subject: `${user.name} invited you to ${workspace.name} on ${brand.name}`,
      text: `${user.name} invited you to join the "${workspace.name}" workspace on ${brand.name}.\n\nAccept the invitation:\n${link}\n\nThis link expires in 7 days.`,
    });
    // The link is returned once so it can be shared manually when email isn't configured.
    return { id: invite.id, link };
  },
  { roles: MANAGERS },
);
