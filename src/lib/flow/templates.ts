/**
 * Ready-made flows for the template gallery and for bootstrapping new workspaces.
 * Tags are referenced as "tag:<Name>" placeholders and resolved to real ids on install.
 */
import {
  HANDLE_FALSE,
  HANDLE_NEXT,
  HANDLE_TRUE,
  buttonHandle,
  quickReplyHandle,
  type FlowAction,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type InputData,
  type Rule,
} from "./types";

export const tagRef = (name: string) => `tag:${name}`;

class Builder {
  nodes: FlowNode[] = [];
  edges: FlowEdge[] = [];
  private n = 0;
  private id(prefix: string) {
    return `${prefix}${(++this.n).toString(36)}`;
  }

  private add(node: FlowNode) {
    this.nodes.push(node);
    return node.id;
  }

  trigger(col = 0, row = 0) {
    return this.add({ id: this.id("t"), type: "trigger", position: pos(col, row), data: {} });
  }

  message(
    col: number,
    row: number,
    text: string,
    opts: { buttons?: { key: string; label: string; url?: string }[]; quick?: { key: string; label: string }[]; image?: string } = {},
  ) {
    const id = this.id("m");
    const blocks: Extract<FlowNode, { type: "message" }>["data"]["blocks"] = [];
    if (opts.image) blocks.push({ id: `${id}i`, type: "image", url: opts.image });
    blocks.push({
      id: `${id}x`,
      type: "text",
      text,
      buttons: (opts.buttons ?? []).map((b) => ({
        id: `${id}${b.key}`,
        label: b.label,
        kind: b.url ? ("url" as const) : ("node" as const),
        url: b.url,
      })),
    });
    return this.add({
      id,
      type: "message",
      position: pos(col, row),
      data: { blocks, quickReplies: (opts.quick ?? []).map((q) => ({ id: `${id}${q.key}`, label: q.label })) },
    });
  }

  input(col: number, row: number, question: string, replyType: InputData["replyType"], saveTo: string) {
    return this.add({
      id: this.id("q"),
      type: "input",
      position: pos(col, row),
      data: { question, replyType, saveTo, retryMessage: "Hmm, that doesn't look right. Could you try again?" },
    });
  }

  action(col: number, row: number, actions: Omit<FlowAction, "id">[]) {
    const id = this.id("a");
    return this.add({
      id,
      type: "action",
      position: pos(col, row),
      data: { actions: actions.map((a, i) => ({ ...a, id: `${id}${i}` })) },
    });
  }

  condition(col: number, row: number, rules: Omit<Rule, "id">[], match: "all" | "any" = "all") {
    const id = this.id("c");
    return this.add({
      id,
      type: "condition",
      position: pos(col, row),
      data: { match, rules: rules.map((r, i) => ({ ...r, id: `${id}${i}` })) },
    });
  }

  delay(col: number, row: number, amount: number, unit: "seconds" | "minutes" | "hours" | "days") {
    return this.add({ id: this.id("d"), type: "delay", position: pos(col, row), data: { amount, unit } });
  }

  link(source: string, target: string, handle: string = HANDLE_NEXT) {
    this.edges.push({ id: `e-${source}-${handle}-${target}`, source, sourceHandle: handle, target });
  }
  button(source: string, key: string, target: string) {
    this.link(source, target, buttonHandle(`${source}${key}`));
  }
  quick(source: string, key: string, target: string) {
    this.link(source, target, quickReplyHandle(`${source}${key}`));
  }

  graph(): FlowGraph {
    return { nodes: this.nodes, edges: this.edges };
  }
}

function pos(col: number, row: number) {
  return { x: col * 400, y: row * 230 };
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: "Essentials" | "Lead generation" | "Support" | "Sales" | "Engagement";
  icon: string;
  /** Custom fields the flow writes to; created on install when missing. */
  fields?: { key: string; label: string; type?: "TEXT" | "NUMBER" }[];
  /** Keyword trigger suggested for this template (created on install). */
  keywords?: string[];
  build: () => FlowGraph;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "welcome",
    name: "Welcome message",
    description: "Greet new contacts, explain what your bot can do and offer a human when needed.",
    category: "Essentials",
    icon: "hand",
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const hello = b.message(1, 0, "Hi {{first_name|there}}! 👋 Thanks for reaching out.\n\nI'm the assistant here. What would you like to do?", {
        buttons: [
          { key: "a", label: "See what I can do" },
          { key: "b", label: "Talk to a human" },
        ],
      });
      const about = b.message(2, -0.5, "I can answer common questions, share updates and take your details so the team can follow up.\n\nJust type your question to get started.");
      const human = b.message(2, 0.7, "Sure — I've let the team know. Someone will reply here shortly. 🙌");
      const handoff = b.action(3, 0.7, [{ type: "handoff" }]);
      b.link(start, hello);
      b.button(hello, "a", about);
      b.button(hello, "b", human);
      b.link(human, handoff);
      return b.graph();
    },
  },
  {
    id: "default-reply",
    name: "Default reply",
    description: "A friendly fallback for messages your bot doesn't understand yet.",
    category: "Essentials",
    icon: "message",
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const sorry = b.message(1, 0, "Sorry, I didn't quite get that. 🤔\n\nYou can pick an option below, or ask for a human.", {
        quick: [
          { key: "a", label: "Main menu" },
          { key: "b", label: "Talk to a human" },
        ],
      });
      const menu = b.message(2, -0.5, "Here's what I can help with:\n\n• Type PRICING for plans\n• Type HOURS for opening times\n• Type HUMAN to reach the team");
      const human = b.message(2, 0.7, "No problem — a team member will be with you soon.");
      const handoff = b.action(3, 0.7, [{ type: "handoff" }]);
      b.link(start, sorry);
      b.quick(sorry, "a", menu);
      b.quick(sorry, "b", human);
      b.link(human, handoff);
      return b.graph();
    },
  },
  {
    id: "lead-capture",
    name: "Lead capture",
    description: "Collect a name and email, tag the contact as a lead and confirm the next step.",
    category: "Lead generation",
    icon: "magnet",
    keywords: ["demo", "quote"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const intro = b.message(1, 0, "Great — let's get you set up. It only takes a few seconds.");
      const name = b.input(2, 0, "First, what's your name?", "text", "first_name");
      const email = b.input(3, 0, "Thanks {{first_name}}! What's the best email to reach you?", "email", "email");
      const tag = b.action(4, 0, [{ type: "add_tag", tagId: tagRef("Lead") }]);
      const done = b.message(5, 0, "Perfect, {{first_name}}. We'll email you at {{email}} shortly. ✅\n\nAnything else I can help with?");
      b.link(start, intro);
      b.link(intro, name);
      b.link(name, email);
      b.link(email, tag);
      b.link(tag, done);
      return b.graph();
    },
  },
  {
    id: "faq-menu",
    name: "FAQ menu",
    description: "Answer your most common questions with a tappable menu.",
    category: "Support",
    icon: "help",
    keywords: ["help", "faq", "menu"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const menu = b.message(1, 0, "Happy to help! What would you like to know?", {
        buttons: [
          { key: "a", label: "Pricing" },
          { key: "b", label: "Opening hours" },
          { key: "c", label: "Contact us" },
        ],
      });
      const pricing = b.message(2, -1, "Our plans start at $29/month. Reply DEMO and we'll walk you through the options.");
      const hours = b.message(2, 0, "We're open Monday–Friday, 9am–6pm. Messages sent outside those hours are answered the next working day.");
      const contact = b.message(2, 1, "You can reach the team right here in chat — just tell us what you need and someone will pick it up.");
      const handoff = b.action(3, 1, [{ type: "handoff" }]);
      b.link(start, menu);
      b.button(menu, "a", pricing);
      b.button(menu, "b", hours);
      b.button(menu, "c", contact);
      b.link(contact, handoff);
      return b.graph();
    },
  },
  {
    id: "coupon",
    name: "Coupon giveaway",
    description: "Trade a discount code for an email address, then follow up the next day.",
    category: "Sales",
    icon: "gift",
    keywords: ["coupon", "discount"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const offer = b.message(1, 0, "🎁 Want 10% off your first order? Tell me where to send the code.");
      const email = b.input(2, 0, "What's your email address?", "email", "email");
      const tag = b.action(3, 0, [{ type: "add_tag", tagId: tagRef("Coupon claimed") }]);
      const code = b.message(4, 0, "Here you go: WELCOME10 🎉\n\nUse it at checkout any time in the next 7 days.");
      const wait = b.delay(5, 0, 1, "days");
      const check = b.condition(6, 0, [{ subject: "tag", key: tagRef("Customer"), op: "has", value: "" }]);
      const nudge = b.message(7, 0.6, "Hi {{first_name|there}} — your 10% code WELCOME10 is still waiting. Need a hand choosing?");
      b.link(start, offer);
      b.link(offer, email);
      b.link(email, tag);
      b.link(tag, code);
      b.link(code, wait);
      b.link(wait, check);
      b.link(check, nudge, HANDLE_FALSE);
      return b.graph();
    },
  },
  {
    id: "feedback",
    name: "Feedback survey",
    description: "Ask for a quick rating and route unhappy customers to your team.",
    category: "Engagement",
    icon: "star",
    fields: [{ key: "rating", label: "Rating", type: "NUMBER" }],
    keywords: ["feedback"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const ask = b.input(1, 0, "How would you rate your experience with us, from 1 (poor) to 5 (great)?", "number", "rating");
      const check = b.condition(2, 0, [{ subject: "field", key: "rating", op: "gt", value: "3" }]);
      const happy = b.message(3, -0.6, "Thank you! 🌟 We're so glad you had a good experience.");
      const promoter = b.action(4, -0.6, [{ type: "add_tag", tagId: tagRef("Promoter") }]);
      const sad = b.message(3, 0.6, "Thanks for being honest — we're sorry it wasn't better. A team member will reach out to make it right.");
      const handoff = b.action(4, 0.6, [{ type: "add_tag", tagId: tagRef("Needs follow-up") }, { type: "handoff" }]);
      b.link(start, ask);
      b.link(ask, check);
      b.link(check, happy, HANDLE_TRUE);
      b.link(check, sad, HANDLE_FALSE);
      b.link(happy, promoter);
      b.link(sad, handoff);
      return b.graph();
    },
  },
  {
    id: "callback",
    name: "Request a callback",
    description: "Collect a phone number and alert your team to call the customer back.",
    category: "Lead generation",
    icon: "phone",
    keywords: ["call me", "callback"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const phone = b.input(1, 0, "Sure! What number should we call you on?", "phone", "phone");
      const act = b.action(2, 0, [{ type: "add_tag", tagId: tagRef("Callback requested") }, { type: "handoff" }]);
      const done = b.message(3, 0, "Got it — we'll call you on {{phone}} as soon as we can. 📞");
      b.link(start, phone);
      b.link(phone, act);
      b.link(act, done);
      return b.graph();
    },
  },
  {
    id: "unsubscribe",
    name: "Unsubscribe",
    description: "Let contacts opt out of broadcasts by typing STOP.",
    category: "Essentials",
    icon: "bell-off",
    keywords: ["stop", "unsubscribe"],
    build() {
      const b = new Builder();
      const start = b.trigger(0, 0);
      const act = b.action(1, 0, [{ type: "unsubscribe" }]);
      const done = b.message(2, 0, "You've been unsubscribed and won't receive further updates. You can message us any time to chat.");
      b.link(start, act);
      b.link(act, done);
      return b.graph();
    },
  },
];

export function getTemplate(id: string) {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Tag names referenced by a template graph. */
export function templateTagNames(graph: FlowGraph): string[] {
  const names = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type === "action") {
      for (const a of node.data.actions) if (a.tagId?.startsWith("tag:")) names.add(a.tagId.slice(4));
    }
    if (node.type === "condition") {
      for (const r of node.data.rules) if (r.subject === "tag" && r.key.startsWith("tag:")) names.add(r.key.slice(4));
    }
  }
  return [...names];
}

/** Replaces "tag:<Name>" placeholders with real tag ids. */
export function resolveTemplateTags(graph: FlowGraph, idByName: Map<string, string>): FlowGraph {
  const swap = (ref: string | undefined) =>
    ref?.startsWith("tag:") ? (idByName.get(ref.slice(4)) ?? "") : (ref ?? "");
  return {
    edges: graph.edges,
    nodes: graph.nodes.map((node) => {
      if (node.type === "action") {
        return { ...node, data: { actions: node.data.actions.map((a) => (a.tagId ? { ...a, tagId: swap(a.tagId) } : a)) } };
      }
      if (node.type === "condition") {
        return {
          ...node,
          data: { ...node.data, rules: node.data.rules.map((r) => (r.subject === "tag" ? { ...r, key: swap(r.key) } : r)) },
        };
      }
      return node;
    }),
  };
}
