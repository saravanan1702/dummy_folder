import { authed } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = authed(async ({ workspace }) => {
  const members = await db.membership.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return {
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
    })),
  };
});
