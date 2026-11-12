import type { TriggerType } from "@/generated/prisma/client";
import { isUnlimited, planOf } from "@/config/plans";
import { brand } from "@/config/brand";
import { ApiError } from "./api";
import { randomToken } from "./crypto";
import { db } from "./db";
import { getTemplate, resolveTemplateTags, templateTagNames } from "./flow/templates";

export const DEFAULT_WIDGET_CONFIG = {
  color: "#6246EA",
  title: "Chat with us",
  greeting: "Hi there 👋 How can we help?",
  position: "right" as "right" | "left",
  placeholder: "Type a message…",
};
export type WidgetConfig = typeof DEFAULT_WIDGET_CONFIG;

/** Installs a gallery template as a flow in the workspace, creating the tags / fields it needs. */
export async function installTemplate(
  workspaceId: string,
  templateId: string,
  opts: { publish?: boolean; trigger?: TriggerType; withKeywords?: boolean; name?: string } = {},
) {
  const template = getTemplate(templateId);
  if (!template) throw new ApiError(404, "Template not found");

  const raw = template.build();
  const idByName = new Map<string, string>();
  for (const name of templateTagNames(raw)) {
    const tag = await db.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {},
      create: { workspaceId, name },
    });
    idByName.set(name, tag.id);
  }
  for (const field of template.fields ?? []) {
    await db.customField.upsert({
      where: { workspaceId_key: { workspaceId, key: field.key } },
      update: {},
      create: { workspaceId, key: field.key, label: field.label, type: field.type ?? "TEXT" },
    });
  }
  const graph = resolveTemplateTags(raw, idByName);

  const flow = await db.flow.create({
    data: {
      workspaceId,
      name: opts.name ?? template.name,
      draft: graph as object,
      status: opts.publish ? "PUBLISHED" : "DRAFT",
      published: opts.publish ? (graph as object) : undefined,
      publishedAt: opts.publish ? new Date() : null,
    },
  });

  if (opts.trigger) {
    await db.trigger.create({
      data: {
        workspaceId,
        flowId: flow.id,
        type: opts.trigger,
        config: opts.trigger === "DEFAULT_REPLY" ? { frequency: "always" } : {},
      },
    });
  }
  if (opts.withKeywords && template.keywords?.length) {
    await db.trigger.create({
      data: {
        workspaceId,
        flowId: flow.id,
        type: "KEYWORD",
        config: { keywords: template.keywords, match: "contains" },
      },
    });
  }
  return flow;
}

/** Creates a workspace with its owner, a website chat channel and a working starter bot. */
export async function createWorkspace(userId: string, name: string) {
  const workspace = await db.workspace.create({
    data: {
      name: name.trim().slice(0, 80) || "My workspace",
      memberships: { create: { userId, role: "OWNER" } },
      channels: {
        create: {
          type: "WEBCHAT",
          name: "Website chat",
          webhookSecret: randomToken(24),
          config: { ...DEFAULT_WIDGET_CONFIG, title: `Chat with ${name.trim().slice(0, 40) || brand.name}` },
        },
      },
    },
  });
  await installTemplate(workspace.id, "welcome", { publish: true, trigger: "WELCOME" });
  await installTemplate(workspace.id, "default-reply", { publish: true, trigger: "DEFAULT_REPLY" });
  return workspace;
}

export interface Usage {
  contacts: number;
  seats: number;
  channels: number;
  flows: number;
  broadcastsThisMonth: number;
}

export async function workspaceUsage(workspaceId: string): Promise<Usage> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [contacts, seats, channels, flows, broadcastsThisMonth] = await Promise.all([
    db.contact.count({ where: { workspaceId, isPreview: false } }),
    db.membership.count({ where: { workspaceId } }),
    db.channel.count({ where: { workspaceId, type: { not: "WEBCHAT" } } }),
    db.flow.count({ where: { workspaceId } }),
    db.broadcast.count({
      where: { workspaceId, status: { in: ["SCHEDULED", "SENDING", "SENT"] }, createdAt: { gte: monthStart } },
    }),
  ]);
  return { contacts, seats, channels, flows, broadcastsThisMonth };
}

/** Throws a 402 with an upgrade hint when the workspace has used up a plan allowance. */
export async function assertWithinLimit(
  workspace: { id: string; plan: string },
  resource: keyof Usage,
  extra = 1,
) {
  const plan = planOf(workspace.plan);
  const limitKey = (
    { contacts: "contacts", seats: "seats", channels: "channels", flows: "flows", broadcastsThisMonth: "broadcastsPerMonth" } as const
  )[resource];
  const limit = plan.limits[limitKey];
  if (isUnlimited(limit)) return;
  const usage = await workspaceUsage(workspace.id);
  if (usage[resource] + extra > limit) {
    const label = { contacts: "contacts", seats: "team seats", channels: "channels", flows: "flows", broadcastsThisMonth: "broadcasts this month" }[resource];
    throw new ApiError(402, `Your ${plan.name} plan includes ${limit.toLocaleString("en-US")} ${label}. Upgrade to add more.`, "plan_limit");
  }
}
