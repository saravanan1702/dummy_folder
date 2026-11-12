import type { Channel, Contact, Conversation } from "@/generated/prisma/client";
import { db } from "../db";
import type { OutboundMessage } from "../channels";
import { FIELD_KEY_RE, isSystemField } from "../contacts";
import {
  HANDLE_FALSE,
  HANDLE_NEXT,
  HANDLE_TRUE,
  branchHandle,
  buttonHandle,
  encodePostback,
  findTrigger,
  graphSchema,
  nextNodeId,
  quickReplyHandle,
  type ConditionData,
  type FlowAction,
  type FlowGraph,
  type FlowNodeOf,
  type Rule,
} from "../flow/types";
import { postWebhook } from "../ssrf";
import { deliver } from "./deliver";
import { enqueue } from "./jobs";
import { contactVariables, renderTemplate } from "./template";

const MAX_STEPS = 60;
const MAX_GOTO_HOPS = 5;
const MAX_INPUT_ATTEMPTS = 3;
const HANDOFF_PAUSE_MS = 24 * 3_600_000;

interface RunContext {
  workspaceId: string;
  flowId: string;
  flowName: string;
  graph: FlowGraph;
  preview: boolean;
  runId: string;
  contact: Contact;
  tagIds: Set<string>;
  conversation: Conversation;
  channel: Channel;
  hops: number;
}

export function parseGraph(json: unknown): FlowGraph | null {
  const parsed = graphSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** The graph a run executes: the draft for builder previews, otherwise the published snapshot of a live flow. */
function liveGraph(
  flow: { status: string; draft: unknown; published: unknown },
  preview: boolean,
): FlowGraph | null {
  if (preview) return parseGraph(flow.draft);
  return flow.status === "PUBLISHED" ? parseGraph(flow.published) : null;
}

async function loadSubject(contactId: string) {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: { tags: { select: { tagId: true } }, channel: true },
  });
  if (!contact) return null;
  const conversation = await db.conversation.upsert({
    where: { contactId: contact.id },
    update: {},
    create: { workspaceId: contact.workspaceId, contactId: contact.id, channelId: contact.channelId },
  });
  const { tags, channel, ...rest } = contact;
  return { contact: rest as Contact, tagIds: new Set(tags.map((t) => t.tagId)), channel, conversation };
}

// ── Entry points ──────────────────────────────────────────────────────

export interface StartOptions {
  flowId: string;
  contactId: string;
  /** What started the run: keyword, welcome, default_reply, ref, broadcast, manual, api, preview… */
  entry: string;
  preview?: boolean;
  broadcastId?: string;
}

/** Starts a flow for a contact from its starting step. Returns false when the flow can't run. */
export async function startFlow(opts: StartOptions): Promise<boolean> {
  const subject = await loadSubject(opts.contactId);
  if (!subject) return false;
  const flow = await db.flow.findFirst({ where: { id: opts.flowId, workspaceId: subject.contact.workspaceId } });
  if (!flow) return false;
  const graph = liveGraph(flow, !!opts.preview);
  if (!graph) return false;
  const trigger = findTrigger(graph);
  if (!trigger) return false;

  // A fresh flow supersedes any question the contact was still expected to answer.
  await db.flowRun.updateMany({
    where: { contactId: subject.contact.id, status: "WAITING_INPUT" },
    data: { status: "CANCELLED" },
  });

  const run = await db.flowRun.create({
    data: {
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      contactId: subject.contact.id,
      entry: opts.entry,
      preview: !!opts.preview,
    },
  });
  if (!opts.preview) {
    await db.flow.update({ where: { id: flow.id }, data: { runCount: { increment: 1 } } });
  }

  await execute(
    {
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      flowName: flow.name,
      graph,
      preview: !!opts.preview,
      runId: run.id,
      hops: 0,
      ...subject,
    },
    nextNodeId(graph, trigger.id, HANDLE_NEXT),
    opts.broadcastId,
  );
  return true;
}

/** Continues a flow after a button or quick-reply click. */
export async function continueFromHandle(opts: {
  flowId: string;
  nodeId: string;
  handle: string;
  contactId: string;
  preview: boolean;
}): Promise<boolean> {
  const subject = await loadSubject(opts.contactId);
  if (!subject) return false;
  // Draft graphs may only be driven by builder preview contacts.
  if (opts.preview && !subject.contact.isPreview) return false;
  const flow = await db.flow.findFirst({ where: { id: opts.flowId, workspaceId: subject.contact.workspaceId } });
  if (!flow) return false;
  const graph = liveGraph(flow, opts.preview);
  if (!graph) return false;
  const target = nextNodeId(graph, opts.nodeId, opts.handle);
  if (!target) return false;

  await db.flowRun.updateMany({
    where: { contactId: subject.contact.id, status: "WAITING_INPUT" },
    data: { status: "CANCELLED" },
  });
  const run = await db.flowRun.create({
    data: {
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      contactId: subject.contact.id,
      entry: "button",
      preview: opts.preview,
    },
  });
  await execute(
    {
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      flowName: flow.name,
      graph,
      preview: opts.preview,
      runId: run.id,
      hops: 0,
      ...subject,
    },
    target,
  );
  return true;
}

/** Resumes a run parked on a delay step (called by the job scheduler). */
export async function resumeRun(runId: string): Promise<void> {
  // Claim atomically so a retried job can't resume the same run twice.
  const claimed = await db.flowRun.updateMany({
    where: { id: runId, status: "WAITING_DELAY" },
    data: { status: "RUNNING" },
  });
  if (claimed.count === 0) return;
  const run = await db.flowRun.findUnique({ where: { id: runId }, include: { flow: true } });
  if (!run || !run.nodeId) return;

  const subject = await loadSubject(run.contactId);
  const graph = liveGraph(run.flow, run.preview);
  if (!subject || !graph || !graph.nodes.some((n) => n.id === run.nodeId)) {
    await db.flowRun.update({ where: { id: run.id }, data: { status: "CANCELLED" } });
    return;
  }
  await execute(
    {
      workspaceId: run.workspaceId,
      flowId: run.flowId,
      flowName: run.flow.name,
      graph,
      preview: run.preview,
      runId: run.id,
      hops: 0,
      ...subject,
    },
    nextNodeId(graph, run.nodeId, HANDLE_NEXT),
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-().]{5,18}[0-9]$/;

/**
 * Feeds a contact's reply to the question step they are parked on.
 * Returns true when the message was consumed by a waiting run.
 */
export async function feedInput(contactId: string, text: string): Promise<boolean> {
  const run = await db.flowRun.findFirst({
    where: { contactId, status: "WAITING_INPUT" },
    orderBy: { updatedAt: "desc" },
    include: { flow: true },
  });
  if (!run || !run.nodeId) return false;

  const subject = await loadSubject(contactId);
  const graph = liveGraph(run.flow, run.preview);
  const node = graph?.nodes.find((n) => n.id === run.nodeId);
  if (!subject || !graph || !node || node.type !== "input") {
    await db.flowRun.update({ where: { id: run.id }, data: { status: "CANCELLED" } });
    return false;
  }

  const ctx: RunContext = {
    workspaceId: run.workspaceId,
    flowId: run.flowId,
    flowName: run.flow.name,
    graph,
    preview: run.preview,
    runId: run.id,
    hops: 0,
    ...subject,
  };

  const answer = text.trim();
  const { replyType, saveTo, retryMessage } = node.data;
  const valid =
    answer.length > 0 &&
    (replyType === "text" ||
      (replyType === "email" && EMAIL_RE.test(answer)) ||
      (replyType === "phone" && PHONE_RE.test(answer)) ||
      (replyType === "number" && Number.isFinite(Number(answer.replace(",", ".")))));

  if (!valid) {
    const attempts = run.attempts + 1;
    if (attempts >= MAX_INPUT_ATTEMPTS) {
      await db.flowRun.update({ where: { id: run.id }, data: { status: "CANCELLED", attempts } });
      return false; // let keywords / default reply take over
    }
    await db.flowRun.update({ where: { id: run.id }, data: { attempts } });
    await say(ctx, { kind: "text", text: retryMessage || "Sorry, that doesn't look right. Please try again." });
    return true;
  }

  if (saveTo) {
    const value = replyType === "number" ? answer.replace(",", ".") : answer;
    await setContactField(ctx, saveTo, value);
  }
  await db.flowRun.update({ where: { id: run.id }, data: { status: "RUNNING" } });
  await execute(ctx, nextNodeId(graph, node.id, HANDLE_NEXT));
  return true;
}

// ── Execution loop ────────────────────────────────────────────────────

async function finish(ctx: RunContext, status: "COMPLETED" | "FAILED", error?: string) {
  await db.flowRun.update({
    where: { id: ctx.runId },
    data: { status, nodeId: null, error: error?.slice(0, 500) ?? null },
  });
}

async function say(ctx: RunContext, message: OutboundMessage, broadcastId?: string) {
  return deliver({
    workspaceId: ctx.workspaceId,
    conversationId: ctx.conversation.id,
    contact: ctx.contact,
    channel: ctx.channel,
    message,
    senderType: "BOT",
    flowId: ctx.flowId,
    broadcastId,
  });
}

async function execute(ctx: RunContext, startNodeId: string | null, broadcastId?: string): Promise<void> {
  let current = startNodeId;
  let steps = 0;

  try {
    while (current) {
      if (++steps > MAX_STEPS) throw new Error("Flow stopped: too many steps (possible loop).");
      const node = ctx.graph.nodes.find((n) => n.id === current);
      if (!node) break;

      switch (node.type) {
        case "trigger":
          current = nextNodeId(ctx.graph, node.id, HANDLE_NEXT);
          break;

        case "message": {
          const ok = await runMessage(ctx, node, broadcastId);
          if (!ok) throw new Error("Message could not be delivered.");
          current = nextNodeId(ctx.graph, node.id, HANDLE_NEXT);
          break;
        }

        case "input": {
          const vars = contactVariables(ctx.contact);
          const sent = await say(ctx, { kind: "text", text: renderTemplate(node.data.question, vars) }, broadcastId);
          if (sent.status === "FAILED") throw new Error(sent.error ?? "Message could not be delivered.");
          await db.flowRun.update({
            where: { id: ctx.runId },
            data: { status: "WAITING_INPUT", nodeId: node.id, attempts: 0 },
          });
          return;
        }

        case "condition":
          current = nextNodeId(ctx.graph, node.id, evaluate(ctx, node.data) ? HANDLE_TRUE : HANDLE_FALSE);
          break;

        case "action":
          for (const action of node.data.actions) await runAction(ctx, action);
          current = nextNodeId(ctx.graph, node.id, HANDLE_NEXT);
          break;

        case "delay": {
          const unitMs = { seconds: 1_000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[node.data.unit];
          // Builder previews fast-forward waits so a flow can be tested end to end.
          const waitMs = ctx.preview ? Math.min(node.data.amount * unitMs, 3_000) : node.data.amount * unitMs;
          await db.flowRun.update({ where: { id: ctx.runId }, data: { status: "WAITING_DELAY", nodeId: node.id } });
          await enqueue("flow.resume", { runId: ctx.runId }, new Date(Date.now() + waitMs));
          return;
        }

        case "randomizer": {
          const branches = node.data.branches;
          const total = branches.reduce((sum, b) => sum + b.weight, 0);
          let pick = branches[0];
          if (total > 0) {
            let roll = Math.random() * total;
            for (const b of branches) {
              roll -= b.weight;
              if (roll < 0) {
                pick = b;
                break;
              }
            }
          } else {
            pick = branches[Math.floor(Math.random() * branches.length)];
          }
          current = nextNodeId(ctx.graph, node.id, branchHandle(pick.id));
          break;
        }

        case "goto": {
          if (++ctx.hops > MAX_GOTO_HOPS) throw new Error("Flow stopped: too many nested flows.");
          const target = await db.flow.findFirst({ where: { id: node.data.flowId, workspaceId: ctx.workspaceId } });
          const targetLive = target ? liveGraph(target, false) : null;
          const graph = targetLive ?? (target && ctx.preview ? liveGraph(target, true) : null);
          const trigger = graph ? findTrigger(graph) : null;
          if (!target || !graph || !trigger) throw new Error("The flow to start is missing or not published.");
          await finish(ctx, "COMPLETED");
          const run = await db.flowRun.create({
            data: {
              workspaceId: ctx.workspaceId,
              flowId: target.id,
              contactId: ctx.contact.id,
              entry: "goto",
              preview: !targetLive,
            },
          });
          if (!ctx.preview) await db.flow.update({ where: { id: target.id }, data: { runCount: { increment: 1 } } });
          ctx.flowId = target.id;
          ctx.flowName = target.name;
          ctx.graph = graph;
          ctx.runId = run.id;
          ctx.preview = !targetLive;
          current = nextNodeId(graph, trigger.id, HANDLE_NEXT);
          break;
        }
      }
    }
    await finish(ctx, "COMPLETED");
  } catch (err) {
    await finish(ctx, "FAILED", err instanceof Error ? err.message : "Flow failed");
  }
}

async function runMessage(ctx: RunContext, node: FlowNodeOf<"message">, broadcastId?: string): Promise<boolean> {
  const vars = contactVariables(ctx.contact);
  const quickReplies = node.data.quickReplies
    .filter((q) => q.label.trim())
    .map((q) => ({
      label: renderTemplate(q.label, vars),
      payload: encodePostback(ctx.flowId, node.id, quickReplyHandle(q.id), ctx.preview),
    }));

  const outgoing: OutboundMessage[] = [];
  for (const block of node.data.blocks) {
    if (block.type === "text") {
      if (!block.text.trim()) continue;
      outgoing.push({
        kind: "text",
        text: renderTemplate(block.text, vars),
        buttons: block.buttons
          .filter((b) => b.label.trim())
          .map((b) =>
            b.kind === "url"
              ? { label: renderTemplate(b.label, vars), url: renderTemplate(b.url ?? "", vars) }
              : {
                  label: renderTemplate(b.label, vars),
                  payload: encodePostback(ctx.flowId, node.id, buttonHandle(b.id), ctx.preview),
                },
          ),
      });
    } else if (block.url.trim()) {
      outgoing.push({ kind: "image", imageUrl: block.url.trim() });
    }
  }
  if (outgoing.length === 0) return true;
  if (quickReplies.length) outgoing[outgoing.length - 1].quickReplies = quickReplies;

  for (const message of outgoing) {
    const sent = await say(ctx, message, broadcastId);
    if (sent.status === "FAILED") return false;
  }
  return true;
}

// ── Conditions ────────────────────────────────────────────────────────

function systemValue(ctx: RunContext, key: string): string {
  const c = ctx.contact;
  switch (key) {
    case "first_name":
      return c.firstName ?? "";
    case "last_name":
      return c.lastName ?? "";
    case "email":
      return c.email ?? "";
    case "phone":
      return c.phone ?? "";
    case "username":
      return c.username ?? "";
    case "channel":
      return ctx.channel.type.toLowerCase();
    case "status":
      return c.status.toLowerCase();
    default:
      return "";
  }
}

function evaluateRule(ctx: RunContext, rule: Rule): boolean {
  if (rule.subject === "tag") {
    const has = ctx.tagIds.has(rule.key);
    return rule.op === "not_has" ? !has : has;
  }
  const fields = (ctx.contact.fields ?? {}) as Record<string, unknown>;
  const raw = rule.subject === "system" ? systemValue(ctx, rule.key) : fields[rule.key];
  const actual = raw === null || raw === undefined ? "" : String(raw);
  const expected = rule.value ?? "";
  const a = actual.trim().toLowerCase();
  const e = expected.trim().toLowerCase();

  switch (rule.op) {
    case "is_set":
      return a !== "";
    case "not_set":
      return a === "";
    case "eq":
      return a === e;
    case "neq":
      return a !== e;
    case "contains":
      return e !== "" && a.includes(e);
    case "gt":
      return Number(a) > Number(e);
    case "lt":
      return a !== "" && Number(a) < Number(e);
    default:
      return false;
  }
}

function evaluate(ctx: RunContext, data: ConditionData): boolean {
  if (data.rules.length === 0) return true;
  return data.match === "any"
    ? data.rules.some((r) => evaluateRule(ctx, r))
    : data.rules.every((r) => evaluateRule(ctx, r));
}

// ── Actions ───────────────────────────────────────────────────────────

async function setContactField(ctx: RunContext, key: string, value: string | null) {
  if (isSystemField(key)) {
    const column = { first_name: "firstName", last_name: "lastName", email: "email", phone: "phone" }[key] as
      | "firstName"
      | "lastName"
      | "email"
      | "phone";
    const trimmed = value ? value.slice(0, 200) : null;
    await db.contact.update({ where: { id: ctx.contact.id }, data: { [column]: trimmed } });
    ctx.contact[column] = trimmed;
    return;
  }
  if (!FIELD_KEY_RE.test(key)) return;
  const fields = { ...((ctx.contact.fields ?? {}) as Record<string, unknown>) };
  if (value === null || value === "") delete fields[key];
  else fields[key] = value.slice(0, 1000);
  await db.contact.update({ where: { id: ctx.contact.id }, data: { fields: fields as object } });
  ctx.contact.fields = fields as never;
}

async function runAction(ctx: RunContext, action: FlowAction) {
  switch (action.type) {
    case "add_tag": {
      if (!action.tagId) return;
      const tag = await db.tag.findFirst({ where: { id: action.tagId, workspaceId: ctx.workspaceId } });
      if (!tag) return;
      await db.contactTag.createMany({ data: [{ contactId: ctx.contact.id, tagId: tag.id }], skipDuplicates: true });
      ctx.tagIds.add(tag.id);
      return;
    }
    case "remove_tag":
      if (!action.tagId) return;
      await db.contactTag.deleteMany({
        where: { contactId: ctx.contact.id, tagId: action.tagId, tag: { workspaceId: ctx.workspaceId } },
      });
      ctx.tagIds.delete(action.tagId);
      return;
    case "set_field":
      if (!action.key) return;
      await setContactField(ctx, action.key, renderTemplate(action.value ?? "", contactVariables(ctx.contact)));
      return;
    case "clear_field":
      if (!action.key) return;
      await setContactField(ctx, action.key, null);
      return;
    case "subscribe":
    case "unsubscribe": {
      const status = action.type === "subscribe" ? "SUBSCRIBED" : "UNSUBSCRIBED";
      await db.contact.update({ where: { id: ctx.contact.id }, data: { status } });
      ctx.contact.status = status;
      return;
    }
    case "handoff":
      // Flag the chat for the team and keep the bot quiet until someone resumes it.
      await db.conversation.update({
        where: { id: ctx.conversation.id },
        data: { status: "OPEN", botPausedUntil: new Date(Date.now() + HANDOFF_PAUSE_MS) },
      });
      return;
    case "close_conversation":
      await db.conversation.update({
        where: { id: ctx.conversation.id },
        data: { status: "CLOSED", botPausedUntil: null, unreadCount: 0 },
      });
      return;
    case "webhook": {
      if (!action.url) return;
      const tags = await db.tag.findMany({ where: { id: { in: [...ctx.tagIds] } }, select: { name: true } });
      try {
        await postWebhook(action.url, {
          event: "flow.webhook",
          sent_at: new Date().toISOString(),
          flow: { id: ctx.flowId, name: ctx.flowName },
          contact: {
            id: ctx.contact.id,
            first_name: ctx.contact.firstName,
            last_name: ctx.contact.lastName,
            email: ctx.contact.email,
            phone: ctx.contact.phone,
            username: ctx.contact.username,
            channel: ctx.channel.type.toLowerCase(),
            status: ctx.contact.status.toLowerCase(),
            tags: tags.map((t) => t.name),
            fields: ctx.contact.fields ?? {},
          },
        });
      } catch (err) {
        // A broken customer endpoint must not break the conversation.
        console.warn(`[flow ${ctx.flowId}] webhook failed:`, err instanceof Error ? err.message : err);
      }
      return;
    }
  }
}
