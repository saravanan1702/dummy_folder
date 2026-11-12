import {
  Clock,
  CornerDownRight,
  GitBranch,
  MessageSquareText,
  Play,
  Shuffle,
  TextCursorInput,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "@/lib/flow/types";

export interface NodeMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  chip: string;
  /** Accent colour of the card's top border. */
  accent: string;
}

export const NODE_META: Record<NodeKind, NodeMeta> = {
  trigger: {
    label: "Starting step",
    description: "Where the flow begins",
    icon: Play,
    chip: "bg-mint-100 text-mint-700",
    accent: "#2cb67d",
  },
  message: {
    label: "Send message",
    description: "Text, images, buttons and quick replies",
    icon: MessageSquareText,
    chip: "bg-brand-100 text-brand-700",
    accent: "#6246ea",
  },
  input: {
    label: "Ask a question",
    description: "Collect a reply and save it to the contact",
    icon: TextCursorInput,
    chip: "bg-sky-100 text-sky-700",
    accent: "#0ea5e9",
  },
  condition: {
    label: "Condition",
    description: "Branch on tags or field values",
    icon: GitBranch,
    chip: "bg-teal-100 text-teal-700",
    accent: "#14b8a6",
  },
  action: {
    label: "Actions",
    description: "Tag, update fields, hand off, call a webhook",
    icon: Zap,
    chip: "bg-amber-100 text-amber-700",
    accent: "#f59e0b",
  },
  delay: {
    label: "Wait",
    description: "Pause before the next step",
    icon: Clock,
    chip: "bg-rose-100 text-rose-700",
    accent: "#f43f5e",
  },
  randomizer: {
    label: "Randomizer",
    description: "Split contacts for A/B tests",
    icon: Shuffle,
    chip: "bg-fuchsia-100 text-fuchsia-700",
    accent: "#d946ef",
  },
  goto: {
    label: "Start another flow",
    description: "Continue in a different flow",
    icon: CornerDownRight,
    chip: "bg-slate-200 text-slate-700",
    accent: "#64748b",
  },
};

/** Step types that can be added from the palette (the starting step is fixed). */
export const ADDABLE: NodeKind[] = ["message", "input", "condition", "action", "delay", "randomizer", "goto"];

export const ACTION_LABELS: Record<string, string> = {
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  set_field: "Set field",
  clear_field: "Clear field",
  subscribe: "Subscribe to broadcasts",
  unsubscribe: "Unsubscribe from broadcasts",
  handoff: "Hand off to a human",
  close_conversation: "Close conversation",
  webhook: "Send to webhook",
};

export const OP_LABELS: Record<string, string> = {
  has: "has",
  not_has: "doesn't have",
  eq: "is",
  neq: "is not",
  contains: "contains",
  is_set: "has any value",
  not_set: "is empty",
  gt: "is greater than",
  lt: "is less than",
};

export const SYSTEM_RULE_KEYS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Subscription status" },
];
