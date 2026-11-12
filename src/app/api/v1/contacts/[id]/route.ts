import { notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { publicContact, publicContactInclude, withApiKey } from "@/lib/public-api";

/** GET /api/v1/contacts/:id */
export const GET = withApiKey<{ id: string }>(async ({ params, workspace }) => {
  const contact = await db.contact.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: publicContactInclude,
  });
  if (!contact) throw notFound("Contact");
  return { data: publicContact(contact) };
});
