"use client";

import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { ExternalLink, ImageIcon, TriangleAlert } from "lucide-react";
import { memo, useEffect, type ReactNode } from "react";
import {
  HANDLE_FALSE,
  HANDLE_NEXT,
  HANDLE_TRUE,
  branchHandle,
  buttonHandle,
  quickReplyHandle,
  type ActionData,
  type ConditionData,
  type DelayData,
  type GotoData,
  type InputData,
  type MessageData,
  type NodeKind,
  type RandomizerData,
} from "@/lib/flow/types";
import { describeTrigger, useBuilder } from "./context";
import { ACTION_LABELS, NODE_META, OP_LABELS, SYSTEM_RULE_KEYS } from "./meta";

export type RFNode = Node<Record<string, unknown>, NodeKind>;

/** A labelled row with its own outgoing connector on the right edge. */
function OutRow({ handleId, children, className }: { handleId: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative", className)}>
      {children}
      <Handle type="source" position={Position.Right} id={handleId} style={{ right: -15 }} />
    </div>
  );
}

function NextRow({ label = "Next step" }: { label?: string }) {
  return (
    <OutRow handleId={HANDLE_NEXT} className="mt-2.5 border-t border-slate-100 pt-2.5 text-right text-xs font-medium text-slate-400">
      {label}
    </OutRow>
  );
}

function Shell({
  id,
  kind,
  selected,
  handles,
  target = true,
  children,
}: {
  id: string;
  kind: NodeKind;
  selected: boolean;
  /** Signature of the node's source handles; re-measures connectors when it changes. */
  handles: string;
  target?: boolean;
  children: ReactNode;
}) {
  const meta = NODE_META[kind];
  const Icon = meta.icon;
  const { problemNodes } = useBuilder();
  const problem = problemNodes.has(id);
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => updateInternals(id), [id, handles, updateInternals]);

  return (
    <div
      className={clsx(
        "w-[272px] rounded-2xl border bg-white px-3.5 pb-3.5 pt-3 shadow-card transition-shadow",
        selected ? "border-brand-500 shadow-[0_0_0_3px_rgb(98_70_234/0.18)]" : problem ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
      )}
      style={{ borderTopWidth: 3, borderTopColor: selected ? undefined : problem ? undefined : meta.accent }}
    >
      {target && <Handle type="target" position={Position.Left} style={{ top: 27 }} />}
      <div className="mb-2.5 flex items-center gap-2">
        <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex-1 truncate text-[13px] font-semibold text-ink">{meta.label}</span>
        {problem && <TriangleAlert className="size-4 text-rose-500" aria-label="Needs attention" />}
      </div>
      {children}
    </div>
  );
}

const Placeholder = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-400">{children}</div>
);

const Preview = ({ children }: { children: ReactNode }) => (
  <div className="whitespace-pre-wrap break-words rounded-xl bg-slate-100 px-3 py-2 text-[13px] leading-snug text-slate-800 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden">
    {children}
  </div>
);

export const TriggerNode = memo(function TriggerNode({ id, selected }: NodeProps<RFNode>) {
  const { triggers } = useBuilder();
  return (
    <Shell id={id} kind="trigger" selected={!!selected} handles="next" target={false}>
      {triggers.length === 0 ? (
        <Placeholder>No trigger yet. Select this step to choose when the flow starts.</Placeholder>
      ) : (
        <ul className="space-y-1.5">
          {triggers.map((t) => (
            <li key={t.id} className={clsx("rounded-lg bg-mint-50 px-2.5 py-1.5 text-xs leading-snug text-mint-700", !t.enabled && "opacity-50")}>
              {describeTrigger(t)}
              {!t.enabled && " (off)"}
            </li>
          ))}
        </ul>
      )}
      <NextRow label="Then" />
    </Shell>
  );
});

export const MessageNode = memo(function MessageNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as MessageData;
  const signature = [
    ...d.blocks.flatMap((b) => (b.type === "text" ? b.buttons.filter((x) => x.kind === "node").map((x) => x.id) : [])),
    ...d.quickReplies.map((q) => q.id),
  ].join(",");
  const empty = d.blocks.every((b) => (b.type === "text" ? !b.text.trim() && b.buttons.length === 0 : !b.url.trim()));

  return (
    <Shell id={id} kind="message" selected={!!selected} handles={signature}>
      {empty ? (
        <Placeholder>Empty message. Select this step to write it.</Placeholder>
      ) : (
        <div className="space-y-2">
          {d.blocks.map((block) =>
            block.type === "image" ? (
              <div key={block.id} className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                {/^https?:\/\//i.test(block.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <ImageIcon className="size-5" />
                )}
              </div>
            ) : (
              <div key={block.id}>
                {block.text.trim() && <Preview>{block.text}</Preview>}
                {block.buttons.length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {block.buttons.map((b) =>
                      b.kind === "node" ? (
                        <OutRow key={b.id} handleId={buttonHandle(b.id)}>
                          <div className="truncate rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-center text-xs font-medium text-brand-700">
                            {b.label || "Button"}
                          </div>
                        </OutRow>
                      ) : (
                        <div key={b.id} className="flex items-center justify-center gap-1 truncate rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                          {b.label || "Link"} <ExternalLink className="size-3" />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ),
          )}
          {d.quickReplies.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              {d.quickReplies.map((q) => (
                <OutRow key={q.id} handleId={quickReplyHandle(q.id)} className="flex justify-end">
                  <span className="max-w-full truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    {q.label || "Quick reply"}
                  </span>
                </OutRow>
              ))}
            </div>
          )}
        </div>
      )}
      <NextRow />
    </Shell>
  );
});

export const InputNode = memo(function InputNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as InputData;
  const { fields } = useBuilder();
  const target =
    { email: "Email", phone: "Phone", first_name: "First name", last_name: "Last name" }[d.saveTo] ??
    fields.find((f) => f.key === d.saveTo)?.label;
  return (
    <Shell id={id} kind="input" selected={!!selected} handles="next">
      {d.question.trim() ? <Preview>{d.question}</Preview> : <Placeholder>No question yet. Select this step to write it.</Placeholder>}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700">Expects {d.replyType}</span>
        {target && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">Saves to {target}</span>}
      </div>
      <NextRow label="After reply" />
    </Shell>
  );
});

export const ConditionNode = memo(function ConditionNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as ConditionData;
  const { tags, fields } = useBuilder();
  const describe = (r: ConditionData["rules"][number]) => {
    if (r.subject === "tag") return `Tag ${OP_LABELS[r.op]} "${tags.find((t) => t.id === r.key)?.name ?? "…"}"`;
    const name =
      r.subject === "system"
        ? (SYSTEM_RULE_KEYS.find((k) => k.key === r.key)?.label ?? r.key)
        : (fields.find((f) => f.key === r.key)?.label ?? (r.key || "Field"));
    const needsValue = r.op !== "is_set" && r.op !== "not_set";
    return `${name} ${OP_LABELS[r.op]}${needsValue ? ` "${r.value}"` : ""}`;
  };
  return (
    <Shell id={id} kind="condition" selected={!!selected} handles="tf">
      {d.rules.length === 0 ? (
        <Placeholder>No rules yet. Select this step to add one.</Placeholder>
      ) : (
        <ul className="space-y-1">
          {d.rules.map((r, i) => (
            <li key={r.id} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs leading-snug text-slate-700">
              {i > 0 && <span className="mr-1 font-semibold uppercase text-teal-700">{d.match === "all" ? "and" : "or"}</span>}
              {describe(r)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
        <OutRow handleId={HANDLE_TRUE} className="text-right text-xs font-semibold text-mint-700">
          Yes, matches
        </OutRow>
        <OutRow handleId={HANDLE_FALSE} className="text-right text-xs font-semibold text-rose-600">
          No, doesn&apos;t match
        </OutRow>
      </div>
    </Shell>
  );
});

export const ActionNode = memo(function ActionNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as ActionData;
  const { tags, fields } = useBuilder();
  const fieldLabel = (key?: string) =>
    ({ email: "Email", phone: "Phone", first_name: "First name", last_name: "Last name" })[key ?? ""] ??
    fields.find((f) => f.key === key)?.label ??
    "…";
  const describe = (a: ActionData["actions"][number]) => {
    switch (a.type) {
      case "add_tag":
      case "remove_tag":
        return `${ACTION_LABELS[a.type]} "${tags.find((t) => t.id === a.tagId)?.name ?? "…"}"`;
      case "set_field":
        return `Set ${fieldLabel(a.key)} to "${a.value ?? ""}"`;
      case "clear_field":
        return `Clear ${fieldLabel(a.key)}`;
      case "webhook": {
        let host = "…";
        try {
          host = new URL(a.url ?? "").host || "…";
        } catch {
          /* not a URL yet */
        }
        return `Send to webhook (${host})`;
      }
      default:
        return ACTION_LABELS[a.type];
    }
  };
  return (
    <Shell id={id} kind="action" selected={!!selected} handles="next">
      {d.actions.length === 0 ? (
        <Placeholder>No actions yet. Select this step to add one.</Placeholder>
      ) : (
        <ul className="space-y-1">
          {d.actions.map((a) => (
            <li key={a.id} className="truncate rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              {describe(a)}
            </li>
          ))}
        </ul>
      )}
      <NextRow />
    </Shell>
  );
});

export const DelayNode = memo(function DelayNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as DelayData;
  const unit = d.amount === 1 ? d.unit.replace(/s$/, "") : d.unit;
  return (
    <Shell id={id} kind="delay" selected={!!selected} handles="next">
      <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-center text-[13px] font-semibold text-rose-700">
        Wait {d.amount} {unit}
      </div>
      <NextRow label="Then" />
    </Shell>
  );
});

export const RandomizerNode = memo(function RandomizerNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as RandomizerData;
  const total = d.branches.reduce((sum, b) => sum + b.weight, 0);
  return (
    <Shell id={id} kind="randomizer" selected={!!selected} handles={d.branches.map((b) => b.id).join(",")}>
      <div className="space-y-1.5">
        {d.branches.map((b, i) => (
          <OutRow key={b.id} handleId={branchHandle(b.id)}>
            <div className="flex items-center justify-between rounded-lg bg-fuchsia-50 px-2.5 py-1.5 text-xs font-medium text-fuchsia-800">
              <span>Path {String.fromCharCode(65 + i)}</span>
              <span className="tabular">{total > 0 ? Math.round((b.weight / total) * 100) : Math.round(100 / d.branches.length)}%</span>
            </div>
          </OutRow>
        ))}
      </div>
    </Shell>
  );
});

export const GotoNode = memo(function GotoNode({ id, data, selected }: NodeProps<RFNode>) {
  const d = data as unknown as GotoData;
  const { flows } = useBuilder();
  const flow = flows.find((f) => f.id === d.flowId);
  return (
    <Shell id={id} kind="goto" selected={!!selected} handles="">
      {flow ? (
        <div className="truncate rounded-xl bg-slate-100 px-3 py-2.5 text-[13px] font-medium text-slate-800">{flow.name}</div>
      ) : (
        <Placeholder>No flow chosen. Select this step to pick one.</Placeholder>
      )}
    </Shell>
  );
});

export const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  input: InputNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  randomizer: RandomizerNode,
  goto: GotoNode,
};
