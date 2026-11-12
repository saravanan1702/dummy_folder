import { z } from "zod";
import { ApiError, open, readJson } from "@/lib/api";
import { getAuth, setActiveWorkspace } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertWithinLimit } from "@/lib/workspace";

const schema = z.object({ token: z.string().min(10).max(200) });

/** Accepts an invitation for an already signed-in user. New users accept through sign-up. */
export const POST = open(
  async ({ req }) => {
    const { token } = await readJson(req, schema);
    const auth = await getAuth();
    if (!auth) throw new ApiError(401, "Sign in to accept this invitation.");

    const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { workspace: true } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new ApiError(400, "This invitation is no longer valid.");
    }
    const already = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: auth.user.id, workspaceId: invite.workspaceId } },
    });
    if (!already) {
      await assertWithinLimit(invite.workspace, "seats");
      await db.membership.create({
        data: { userId: auth.user.id, workspaceId: invite.workspaceId, role: invite.role },
      });
    }
    await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await setActiveWorkspace(invite.workspaceId);
    return { ok: true };
  },
  { sameOrigin: true },
);
