import { authed } from "@/lib/api";
import { FLOW_TEMPLATES } from "@/lib/flow/templates";

export const GET = authed(async () => {
  return {
    templates: FLOW_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      keywords: t.keywords ?? [],
      steps: t.build().nodes.length - 1,
    })),
  };
});
