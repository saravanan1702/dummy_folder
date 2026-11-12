/**
 * Flow graph model shared by the visual builder (client) and the automation
 * engine (server). Keep this file free of server-only imports.
 */
import { z } from "zod";

export const NODE_KINDS = [
  "trigger",
  "message",
  "input",
  "condition",
  "action",
  "delay",
  "randomizer",
  "goto",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

const id = z.string().min(1).max(12).regex(/^[a-z0-9]+$/i);
const text = (max: number) => z.string().max(max);

// ── Message ───────────────────────────────────────────────────────────

export const buttonSchema = z.object({
  id,
  label: text(40),
  kind: z.enum(["node", "url"]),
  url: text(1000).optional(),
});
export type FlowButton = z.infer<typeof buttonSchema>;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("text"), text: text(2000), buttons: z.array(buttonSchema).max(3) }),
  z.object({ id, type: z.literal("image"), url: text(1000) }),
]);
export type MessageBlock = z.infer<typeof blockSchema>;

export const quickReplySchema = z.object({ id, label: text(20) });
export type QuickReply = z.infer<typeof quickReplySchema>;

export const messageDataSchema = z.object({
  blocks: z.array(blockSchema).max(10),
  quickReplies: z.array(quickReplySchema).max(10),
});
export type MessageData = z.infer<typeof messageDataSchema>;

// ── User input ────────────────────────────────────────────────────────

export const inputDataSchema = z.object({
  question: text(2000),
  replyType: z.enum(["text", "email", "phone", "number"]),
  /** "email" | "phone" | "first_name" | "last_name" | custom field key. Empty = don't save. */
  saveTo: text(60),
  retryMessage: text(500),
});
export type InputData = z.infer<typeof inputDataSchema>;

// ── Condition ─────────────────────────────────────────────────────────

export const RULE_OPS = ["has", "not_has", "eq", "neq", "contains", "is_set", "not_set", "gt", "lt"] as const;
export const ruleSchema = z.object({
  id,
  /** tag: key = tag id · field: key = custom field key · system: key = email|phone|first_name|last_name|channel|status */
  subject: z.enum(["tag", "field", "system"]),
  key: text(60),
  op: z.enum(RULE_OPS),
  value: text(200),
});
export type Rule = z.infer<typeof ruleSchema>;

export const conditionDataSchema = z.object({
  match: z.enum(["all", "any"]),
  rules: z.array(ruleSchema).max(10),
});
export type ConditionData = z.infer<typeof conditionDataSchema>;

// ── Action ────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  "add_tag",
  "remove_tag",
  "set_field",
  "clear_field",
  "subscribe",
  "unsubscribe",
  "handoff",
  "close_conversation",
  "webhook",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const actionSchema = z.object({
  id,
  type: z.enum(ACTION_TYPES),
  tagId: text(40).optional(),
  key: text(60).optional(),
  value: text(500).optional(),
  url: text(1000).optional(),
});
export type FlowAction = z.infer<typeof actionSchema>;

export const actionDataSchema = z.object({ actions: z.array(actionSchema).max(10) });
export type ActionData = z.infer<typeof actionDataSchema>;

// ── Delay / randomizer / goto ─────────────────────────────────────────

export const delayDataSchema = z.object({
  amount: z.number().int().min(1).max(10_000),
  unit: z.enum(["seconds", "minutes", "hours", "days"]),
});
export type DelayData = z.infer<typeof delayDataSchema>;

export const randomizerDataSchema = z.object({
  branches: z.array(z.object({ id, weight: z.number().int().min(0).max(100) })).min(2).max(6),
});
export type RandomizerData = z.infer<typeof randomizerDataSchema>;

export const gotoDataSchema = z.object({ flowId: text(40) });
export type GotoData = z.infer<typeof gotoDataSchema>;

export const triggerDataSchema = z.object({}).loose();

// ── Graph ─────────────────────────────────────────────────────────────

const position = z.object({ x: z.number().finite(), y: z.number().finite() });

export const nodeSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("trigger"), position, data: triggerDataSchema }),
  z.object({ id, type: z.literal("message"), position, data: messageDataSchema }),
  z.object({ id, type: z.literal("input"), position, data: inputDataSchema }),
  z.object({ id, type: z.literal("condition"), position, data: conditionDataSchema }),
  z.object({ id, type: z.literal("action"), position, data: actionDataSchema }),
  z.object({ id, type: z.literal("delay"), position, data: delayDataSchema }),
  z.object({ id, type: z.literal("randomizer"), position, data: randomizerDataSchema }),
  z.object({ id, type: z.literal("goto"), position, data: gotoDataSchema }),
]);
export type FlowNode = z.infer<typeof nodeSchema>;
export type FlowNodeOf<K extends NodeKind> = Extract<FlowNode, { type: K }>;

export const edgeSchema = z.object({
  id: z.string().min(1).max(80),
  source: id,
  sourceHandle: z.string().max(30).nullish(),
  target: id,
});
export type FlowEdge = z.infer<typeof edgeSchema>;

export const graphSchema = z.object({
  nodes: z.array(nodeSchema).max(200),
  edges: z.array(edgeSchema).max(600),
});
export type FlowGraph = z.infer<typeof graphSchema>;

// ── Handles ───────────────────────────────────────────────────────────

export const HANDLE_NEXT = "next";
export const HANDLE_TRUE = "true";
export const HANDLE_FALSE = "false";
export const buttonHandle = (buttonId: string) => `b.${buttonId}`;
export const quickReplyHandle = (qrId: string) => `q.${qrId}`;
export const branchHandle = (branchId: string) => `r.${branchId}`;

/** All source handles a node exposes, in display order. */
export function sourceHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "message": {
      const out: string[] = [];
      for (const block of node.data.blocks) {
        if (block.type === "text") {
          for (const b of block.buttons) if (b.kind === "node") out.push(buttonHandle(b.id));
        }
      }
      for (const q of node.data.quickReplies) out.push(quickReplyHandle(q.id));
      out.push(HANDLE_NEXT);
      return out;
    }
    case "condition":
      return [HANDLE_TRUE, HANDLE_FALSE];
    case "randomizer":
      return node.data.branches.map((b) => branchHandle(b.id));
    case "goto":
      return [];
    default:
      return [HANDLE_NEXT];
  }
}

export function nextNodeId(graph: FlowGraph, nodeId: string, handle: string): string | null {
  const edge = graph.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? HANDLE_NEXT) === handle);
  return edge?.target ?? null;
}

export function findTrigger(graph: FlowGraph): FlowNodeOf<"trigger"> | null {
  return (graph.nodes.find((n) => n.type === "trigger") as FlowNodeOf<"trigger"> | undefined) ?? null;
}

// ── Postback payloads (button / quick-reply clicks) ───────────────────
// Kept under 64 bytes: that is Telegram's callback_data limit.

export function encodePostback(flowId: string, nodeId: string, handle: string, preview: boolean): string {
  return `${preview ? "d" : "p"}:${flowId}:${nodeId}:${handle}`;
}

export function decodePostback(
  payload: string,
): { flowId: string; nodeId: string; handle: string; preview: boolean } | null {
  const parts = payload.split(":");
  if (parts.length !== 4 || (parts[0] !== "p" && parts[0] !== "d")) return null;
  const [mode, flowId, nodeId, handle] = parts;
  if (!flowId || !nodeId || !handle) return null;
  return { flowId, nodeId, handle, preview: mode === "d" };
}

// ── Defaults & validation ─────────────────────────────────────────────

export function newId(len = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const cryptoObj = globalThis.crypto;
  const buf = new Uint8Array(len);
  cryptoObj.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function defaultNodeData(kind: NodeKind): FlowNode["data"] {
  switch (kind) {
    case "message":
      return { blocks: [{ id: newId(), type: "text", text: "", buttons: [] }], quickReplies: [] };
    case "input":
      return { question: "", replyType: "text", saveTo: "", retryMessage: "Sorry, that doesn't look right. Please try again." };
    case "condition":
      return { match: "all", rules: [] };
    case "action":
      return { actions: [] };
    case "delay":
      return { amount: 1, unit: "hours" };
    case "randomizer":
      return { branches: [{ id: newId(), weight: 50 }, { id: newId(), weight: 50 }] };
    case "goto":
      return { flowId: "" };
    default:
      return {};
  }
}

export function emptyGraph(): FlowGraph {
  return {
    nodes: [{ id: newId(), type: "trigger", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  };
}

export interface FlowIssue {
  nodeId?: string;
  message: string;
}

/** Problems that would make a published flow misbehave. Empty array = ready to publish. */
export function validateGraph(graph: FlowGraph): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const trigger = findTrigger(graph);
  if (!trigger) {
    issues.push({ message: "The flow has no starting step." });
    return issues;
  }
  if (!nextNodeId(graph, trigger.id, HANDLE_NEXT)) {
    issues.push({ nodeId: trigger.id, message: "Connect the starting step to your first step." });
  }
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    switch (node.type) {
      case "message": {
        if (node.data.blocks.length === 0) issues.push({ nodeId: node.id, message: "A message step is empty." });
        for (const block of node.data.blocks) {
          if (block.type === "text") {
            if (!block.text.trim()) issues.push({ nodeId: node.id, message: "A text message is empty." });
            for (const b of block.buttons) {
              if (!b.label.trim()) issues.push({ nodeId: node.id, message: "A button has no label." });
              if (b.kind === "url" && !/^https?:\/\//i.test(b.url ?? "")) {
                issues.push({ nodeId: node.id, message: `Button "${b.label || "…"}" needs a valid https:// link.` });
              }
            }
          } else if (!/^https?:\/\//i.test(block.url)) {
            issues.push({ nodeId: node.id, message: "An image block needs a valid image URL." });
          }
        }
        for (const q of node.data.quickReplies) {
          if (!q.label.trim()) issues.push({ nodeId: node.id, message: "A quick reply has no label." });
        }
        break;
      }
      case "input":
        if (!node.data.question.trim()) issues.push({ nodeId: node.id, message: "A question step has no question text." });
        break;
      case "condition":
        if (node.data.rules.length === 0) issues.push({ nodeId: node.id, message: "A condition step has no rules." });
        break;
      case "action":
        if (node.data.actions.length === 0) issues.push({ nodeId: node.id, message: "An action step has no actions." });
        for (const a of node.data.actions) {
          if ((a.type === "add_tag" || a.type === "remove_tag") && !a.tagId) {
            issues.push({ nodeId: node.id, message: "Choose a tag for the tag action." });
          }
          if ((a.type === "set_field" || a.type === "clear_field") && !a.key) {
            issues.push({ nodeId: node.id, message: "Choose a field for the field action." });
          }
          if (a.type === "webhook" && !/^https:\/\//i.test(a.url ?? "")) {
            issues.push({ nodeId: node.id, message: "Webhook actions need an https:// URL." });
          }
        }
        break;
      case "goto":
        if (!node.data.flowId) issues.push({ nodeId: node.id, message: "Choose which flow to start." });
        break;
    }
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({ message: "The flow contains a broken connection. Re-connect the affected steps." });
      break;
    }
  }
  return issues;
}
