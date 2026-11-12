import { z } from "zod";
import { ApiError, clientIp, open, readJson } from "@/lib/api";
import { createSession, setActiveWorkspace } from "@/lib/auth";
import { hashPassword, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { assertWithinLimit, createWorkspace } from "@/lib/workspace";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  workspaceName: z.string().trim().max(80).optional(),
  inviteToken: z.string().max(200).optional(),
});

export const POST = open(
  async ({ req }) => {
    await rateLimit(`signup:${clientIp(req)}`, 10, 3600);
    const input = await readJson(req, schema);

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError(409, "An account with this email already exists. Try signing in instead.");

    // Joining an existing workspace through an invite link.
    let invite = null;
    if (input.inviteToken) {
      invite = await db.invite.findUnique({
        where: { tokenHash: sha256(input.inviteToken) },
        include: { workspace: true },
      });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new ApiError(400, "This invitation is no longer valid. Ask your teammate for a new one.");
      }
      await assertWithinLimit(invite.workspace, "seats");
    }

    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
    });

    let workspaceId: string;
    if (invite) {
      await db.$transaction([
        db.membership.create({ data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role } }),
        db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      ]);
      workspaceId = invite.workspaceId;
    } else {
      const workspace = await createWorkspace(user.id, input.workspaceName || `${input.name.split(" ")[0]}'s workspace`);
      workspaceId = workspace.id;
    }

    await createSession(user.id, req.headers.get("user-agent"));
    await setActiveWorkspace(workspaceId);
    return { ok: true };
  },
  { sameOrigin: true },
);
