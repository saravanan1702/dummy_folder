"use client";

import clsx from "clsx";
import { Braces, ImageIcon, Plus, Trash2, Type, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button, Field, IconButton, Menu, MenuItem, Toggle, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { SYSTEM_FIELDS } from "@/lib/contacts";
import {
  ACTION_TYPES,
  newId,
  type ActionData,
  type ConditionData,
  type DelayData,
  type FlowAction,
  type GotoData,
  type InputData,
  type MessageData,
  type NodeKind,
  type RandomizerData,
  type Rule,
} from "@/lib/flow/types";
import { describeTrigger, useBuilder } from "./context";
import { ACTION_LABELS, OP_LABELS, SYSTEM_RULE_KEYS } from "./meta";

type Change<T> = (next: T) => void;

const Section = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <section className="border-b border-slate-100 px-5 py-4 last:border-b-0">
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const AddButton = ({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-600"
  >
    <Plus className="size-4" /> {children}
  </button>
);

// ── Text area with personalisation variables ──────────────────────────

function VariableTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { fields } = useBuilder();
  const variables = [
    { key: "first_name|there", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "full_name", label: "Full name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    ...fields.map((f) => ({ key: f.key, label: f.label })),
  ];

  function insert(key: string) {
    const el = ref.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, start) + token + value.slice(end)).slice(0, maxLength);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/15">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="block w-full resize-y rounded-t-lg bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-slate-400"
      />
      <div className="flex items-center justify-between border-t border-slate-100 px-1.5 py-1">
        <Menu
          align="left"
          width={190}
          trigger={(props) => (
            <button type="button" {...props} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-ink">
              <Braces className="size-3.5" /> Personalize
            </button>
          )}
        >
          {(close) => (
            <div className="scroll-thin max-h-56 overflow-y-auto">
              {variables.map((v) => (
                <MenuItem
                  key={v.key}
                  onClick={() => {
                    insert(v.key);
                    close();
                  }}
                >
                  {v.label}
                </MenuItem>
              ))}
            </div>
          )}
        </Menu>
        <span className="tabular pr-1.5 text-[11px] text-slate-400">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

// ── Tag picker with inline create ─────────────────────────────────────

export function TagSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { tags, refreshTags } = useBuilder();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ tag: { id: string } }>("/api/tags", { body: { name } });
      refreshTags();
      onChange(res.tag.id);
      setCreating(false);
      setName("");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <div className="flex gap-1.5">
        <input
          className="input"
          autoFocus
          value={name}
          maxLength={50}
          placeholder="New tag name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
            if (e.key === "Escape") setCreating(false);
          }}
        />
        <Button size="sm" className="h-auto" loading={busy} onClick={create}>
          Add
        </Button>
        <IconButton label="Cancel" onClick={() => setCreating(false)} className="h-auto">
          <X className="size-4" />
        </IconButton>
      </div>
    );
  }
  return (
    <select
      className="input"
      value={value}
      aria-label="Tag"
      onChange={(e) => (e.target.value === "__new" ? setCreating(true) : onChange(e.target.value))}
    >
      <option value="">Choose a tag…</option>
      {tags.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
      <option value="__new">+ Create new tag…</option>
    </select>
  );
}

function FieldSelect({ value, onChange, allowNone }: { value: string; onChange: (key: string) => void; allowNone?: string }) {
  const { fields } = useBuilder();
  return (
    <select className="input" value={value} aria-label="Field" onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowNone ?? "Choose a field…"}</option>
      <optgroup label="Contact info">
        {SYSTEM_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </optgroup>
      {fields.length > 0 && (
        <optgroup label="Custom fields">
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// ── Message ───────────────────────────────────────────────────────────

function MessageEditor({ data, onChange }: { data: MessageData; onChange: Change<MessageData> }) {
  const setBlock = (id: string, patch: Record<string, unknown>) =>
    onChange({ ...data, blocks: data.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as typeof b) : b)) });

  return (
    <>
      {data.blocks.map((block, index) => (
        <Section
          key={block.id}
          title={block.type === "text" ? `Text ${data.blocks.length > 1 ? index + 1 : ""}` : "Image"}
          action={
            data.blocks.length > 1 && (
              <IconButton label="Remove block" className="-mr-1.5 size-7" onClick={() => onChange({ ...data, blocks: data.blocks.filter((b) => b.id !== block.id) })}>
                <Trash2 className="size-4" />
              </IconButton>
            )
          }
        >
          {block.type === "text" ? (
            <>
              <VariableTextarea value={block.text} maxLength={2000} placeholder="Write your message…" onChange={(text) => setBlock(block.id, { text })} />
              <div className="mt-3 space-y-2">
                {block.buttons.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        className="input"
                        aria-label="Button label"
                        value={b.label}
                        maxLength={20}
                        placeholder="Button label"
                        onChange={(e) => setBlock(block.id, { buttons: block.buttons.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })}
                      />
                      <IconButton label="Remove button" onClick={() => setBlock(block.id, { buttons: block.buttons.filter((x) => x.id !== b.id) })}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                    <div className="mt-2 flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-medium">
                      {(
                        [
                          ["node", "Go to a step"],
                          ["url", "Open website"],
                        ] as const
                      ).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={b.kind === kind}
                          onClick={() => setBlock(block.id, { buttons: block.buttons.map((x) => (x.id === b.id ? { ...x, kind } : x)) })}
                          className={clsx("flex-1 rounded-md px-2 py-1 transition-colors", b.kind === kind ? "bg-white text-ink shadow-xs" : "text-slate-500")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {b.kind === "url" ? (
                      <input
                        className="input mt-2"
                        aria-label="Website address"
                        type="url"
                        value={b.url ?? ""}
                        maxLength={1000}
                        placeholder="https://example.com"
                        onChange={(e) => setBlock(block.id, { buttons: block.buttons.map((x) => (x.id === b.id ? { ...x, url: e.target.value } : x)) })}
                      />
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Drag from this button&apos;s dot on the canvas to choose what happens next.</p>
                    )}
                  </div>
                ))}
                <AddButton
                  disabled={block.buttons.length >= 3}
                  onClick={() => setBlock(block.id, { buttons: [...block.buttons, { id: newId(), label: "", kind: "node" }] })}
                >
                  Add button {block.buttons.length >= 3 && "(max 3)"}
                </AddButton>
              </div>
            </>
          ) : (
            <Field hint="Paste a public https:// link to a JPG, PNG or GIF.">
              <input className="input" type="url" value={block.url} maxLength={1000} placeholder="https://…/image.jpg" onChange={(e) => setBlock(block.id, { url: e.target.value })} />
            </Field>
          )}
        </Section>
      ))}

      <Section title="Add content">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Type className="size-4" />}
            disabled={data.blocks.length >= 10}
            onClick={() => onChange({ ...data, blocks: [...data.blocks, { id: newId(), type: "text", text: "", buttons: [] }] })}
          >
            Text
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ImageIcon className="size-4" />}
            disabled={data.blocks.length >= 10}
            onClick={() => onChange({ ...data, blocks: [...data.blocks, { id: newId(), type: "image", url: "" }] })}
          >
            Image
          </Button>
        </div>
      </Section>

      <Section title="Quick replies">
        <p className="mb-2.5 text-xs leading-relaxed text-slate-500">Tappable suggestions shown under the message. Each one can lead to a different step.</p>
        <div className="space-y-2">
          {data.quickReplies.map((q) => (
            <div key={q.id} className="flex items-center gap-1.5">
              <input
                className="input"
                aria-label="Quick reply label"
                value={q.label}
                maxLength={20}
                placeholder="Quick reply"
                onChange={(e) => onChange({ ...data, quickReplies: data.quickReplies.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)) })}
              />
              <IconButton label="Remove quick reply" onClick={() => onChange({ ...data, quickReplies: data.quickReplies.filter((x) => x.id !== q.id) })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <AddButton disabled={data.quickReplies.length >= 10} onClick={() => onChange({ ...data, quickReplies: [...data.quickReplies, { id: newId(), label: "" }] })}>
            Add quick reply
          </AddButton>
        </div>
      </Section>
    </>
  );
}

// ── Question ──────────────────────────────────────────────────────────

function InputEditor({ data, onChange }: { data: InputData; onChange: Change<InputData> }) {
  return (
    <>
      <Section title="Question">
        <VariableTextarea value={data.question} maxLength={2000} rows={3} placeholder="What would you like to ask?" onChange={(question) => onChange({ ...data, question })} />
      </Section>
      <Section title="Reply">
        <div className="space-y-3.5">
          <Field label="Expected answer">
            <select className="input" value={data.replyType} onChange={(e) => onChange({ ...data, replyType: e.target.value as InputData["replyType"] })}>
              <option value="text">Any text</option>
              <option value="email">Email address</option>
              <option value="phone">Phone number</option>
              <option value="number">Number</option>
            </select>
          </Field>
          <Field label="Save the answer to" hint="Stored on the contact so you can use it in messages, conditions and broadcasts.">
            <FieldSelect value={data.saveTo} allowNone="Don't save" onChange={(saveTo) => onChange({ ...data, saveTo })} />
          </Field>
          {data.replyType !== "text" && (
            <Field label="If the answer isn't valid, say" hint="After three invalid answers the bot stops asking.">
              <input className="input" value={data.retryMessage} maxLength={500} onChange={(e) => onChange({ ...data, retryMessage: e.target.value })} />
            </Field>
          )}
        </div>
      </Section>
    </>
  );
}

// ── Condition ─────────────────────────────────────────────────────────

const OPS_FOR: Record<Rule["subject"], Rule["op"][]> = {
  tag: ["has", "not_has"],
  field: ["eq", "neq", "contains", "is_set", "not_set", "gt", "lt"],
  system: ["eq", "neq", "contains", "is_set", "not_set"],
};

function ConditionEditor({ data, onChange }: { data: ConditionData; onChange: Change<ConditionData> }) {
  const { fields } = useBuilder();
  const setRule = (id: string, patch: Partial<Rule>) => onChange({ ...data, rules: data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <Section title="Rules">
      {data.rules.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-[13px] text-slate-600">
          Continue on &ldquo;Yes&rdquo; when
          <select className="input w-auto py-1" value={data.match} aria-label="Match" onChange={(e) => onChange({ ...data, match: e.target.value as "all" | "any" })}>
            <option value="all">all rules match</option>
            <option value="any">any rule matches</option>
          </select>
        </div>
      )}
      <div className="space-y-2">
        {data.rules.map((rule) => (
          <div key={rule.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5">
              <select
                className="input"
                aria-label="Rule type"
                value={rule.subject}
                onChange={(e) => {
                  const subject = e.target.value as Rule["subject"];
                  setRule(rule.id, { subject, key: "", op: OPS_FOR[subject][0], value: "" });
                }}
              >
                <option value="tag">Tag</option>
                <option value="field">Custom field</option>
                <option value="system">Contact info</option>
              </select>
              <IconButton label="Remove rule" onClick={() => onChange({ ...data, rules: data.rules.filter((r) => r.id !== rule.id) })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
            {rule.subject === "tag" ? (
              <TagSelect value={rule.key} onChange={(key) => setRule(rule.id, { key })} />
            ) : (
              <select className="input" aria-label="Field" value={rule.key} onChange={(e) => setRule(rule.id, { key: e.target.value })}>
                <option value="">Choose…</option>
                {(rule.subject === "system" ? SYSTEM_RULE_KEYS : fields).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-1.5">
              <select className="input" aria-label="Comparison" value={rule.op} onChange={(e) => setRule(rule.id, { op: e.target.value as Rule["op"] })}>
                {OPS_FOR[rule.subject].map((op) => (
                  <option key={op} value={op}>
                    {OP_LABELS[op]}
                  </option>
                ))}
              </select>
              {rule.subject !== "tag" && rule.op !== "is_set" && rule.op !== "not_set" && (
                <input
                  className="input"
                  aria-label="Value"
                  value={rule.value}
                  maxLength={200}
                  placeholder={rule.key === "channel" ? "telegram, whatsapp…" : rule.key === "status" ? "subscribed" : "Value"}
                  onChange={(e) => setRule(rule.id, { value: e.target.value })}
                />
              )}
            </div>
          </div>
        ))}
        <AddButton
          disabled={data.rules.length >= 10}
          onClick={() => onChange({ ...data, rules: [...data.rules, { id: newId(), subject: "tag", key: "", op: "has", value: "" }] })}
        >
          Add rule
        </AddButton>
      </div>
    </Section>
  );
}

// ── Actions ───────────────────────────────────────────────────────────

function ActionEditor({ data, onChange }: { data: ActionData; onChange: Change<ActionData> }) {
  const setAction = (id: string, patch: Partial<FlowAction>) => onChange({ actions: data.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  return (
    <Section title="Actions">
      <p className="mb-2.5 text-xs leading-relaxed text-slate-500">Actions run instantly, in order, without sending anything to the contact.</p>
      <div className="space-y-2">
        {data.actions.map((action) => (
          <div key={action.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5">
              <select
                className="input"
                aria-label="Action"
                value={action.type}
                onChange={(e) => setAction(action.id, { type: e.target.value as FlowAction["type"], tagId: undefined, key: undefined, value: undefined, url: undefined })}
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
              <IconButton label="Remove action" onClick={() => onChange({ actions: data.actions.filter((a) => a.id !== action.id) })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
            {(action.type === "add_tag" || action.type === "remove_tag") && <TagSelect value={action.tagId ?? ""} onChange={(tagId) => setAction(action.id, { tagId })} />}
            {(action.type === "set_field" || action.type === "clear_field") && <FieldSelect value={action.key ?? ""} onChange={(key) => setAction(action.id, { key })} />}
            {action.type === "set_field" && (
              <input
                className="input"
                aria-label="Value"
                value={action.value ?? ""}
                maxLength={500}
                placeholder="Value (you can use {{first_name}})"
                onChange={(e) => setAction(action.id, { value: e.target.value })}
              />
            )}
            {action.type === "webhook" && (
              <Field hint="We POST the contact's details as JSON to this address.">
                <input className="input" type="url" value={action.url ?? ""} maxLength={1000} placeholder="https://your-app.com/hook" onChange={(e) => setAction(action.id, { url: e.target.value })} />
              </Field>
            )}
            {action.type === "handoff" && <p className="text-xs leading-relaxed text-slate-500">Opens the conversation in Live Chat and pauses the bot until your team closes it.</p>}
          </div>
        ))}
        <AddButton disabled={data.actions.length >= 10} onClick={() => onChange({ actions: [...data.actions, { id: newId(), type: "add_tag" }] })}>
          Add action
        </AddButton>
      </div>
    </Section>
  );
}

// ── Delay / randomizer / goto ─────────────────────────────────────────

function DelayEditor({ data, onChange }: { data: DelayData; onChange: Change<DelayData> }) {
  return (
    <Section title="Wait">
      <div className="flex gap-2">
        <input
          className="input w-24"
          type="number"
          aria-label="Amount"
          min={1}
          max={10000}
          value={data.amount}
          onChange={(e) => onChange({ ...data, amount: Math.min(10000, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
        />
        <select className="input" aria-label="Unit" value={data.unit} onChange={(e) => onChange({ ...data, unit: e.target.value as DelayData["unit"] })}>
          <option value="seconds">seconds</option>
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
        The flow pauses here, then continues automatically. In Preview, waits are shortened to a few seconds so you can test quickly.
      </p>
    </Section>
  );
}

function RandomizerEditor({ data, onChange }: { data: RandomizerData; onChange: Change<RandomizerData> }) {
  const total = data.branches.reduce((sum, b) => sum + b.weight, 0);
  return (
    <Section title="Paths">
      <p className="mb-2.5 text-xs leading-relaxed text-slate-500">Each contact is sent down one path at random, in proportion to its weight.</p>
      <div className="space-y-2">
        {data.branches.map((b, i) => (
          <div key={b.id} className="flex items-center gap-2">
            <span className="w-14 text-[13px] font-medium text-slate-700">Path {String.fromCharCode(65 + i)}</span>
            <input
              className="input w-20"
              type="number"
              aria-label={`Weight of path ${String.fromCharCode(65 + i)}`}
              min={0}
              max={100}
              value={b.weight}
              onChange={(e) =>
                onChange({ branches: data.branches.map((x) => (x.id === b.id ? { ...x, weight: Math.min(100, Math.max(0, Math.round(Number(e.target.value)) || 0)) } : x)) })
              }
            />
            <span className="tabular flex-1 text-xs text-slate-500">{total > 0 ? Math.round((b.weight / total) * 100) : 0}% of contacts</span>
            <IconButton label="Remove path" disabled={data.branches.length <= 2} onClick={() => onChange({ branches: data.branches.filter((x) => x.id !== b.id) })}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        ))}
        <AddButton disabled={data.branches.length >= 6} onClick={() => onChange({ branches: [...data.branches, { id: newId(), weight: 50 }] })}>
          Add path
        </AddButton>
      </div>
    </Section>
  );
}

function GotoEditor({ data, onChange }: { data: GotoData; onChange: Change<GotoData> }) {
  const { flows, flowId } = useBuilder();
  return (
    <Section title="Flow to start">
      <select className="input" aria-label="Flow" value={data.flowId} onChange={(e) => onChange({ flowId: e.target.value })}>
        <option value="">Choose a flow…</option>
        {flows
          .filter((f) => f.id !== flowId)
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.status !== "PUBLISHED" ? " (draft)" : ""}
            </option>
          ))}
      </select>
      <p className="mt-2.5 text-xs leading-relaxed text-slate-500">This flow ends here and the contact continues in the chosen flow, which must be published.</p>
    </Section>
  );
}

// ── Triggers (starting step) ──────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { type: "KEYWORD", label: "Contact sends a keyword" },
  { type: "WELCOME", label: "New contact's first message (welcome)" },
  { type: "DEFAULT_REPLY", label: "No other flow matches (default reply)" },
  { type: "REF_LINK", label: "Contact opens a link or QR code" },
] as const;

export function TriggerForm({ flowId, onDone, onCancel }: { flowId: string; onDone: () => void; onCancel?: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<(typeof TRIGGER_OPTIONS)[number]["type"]>("KEYWORD");
  const [keywords, setKeywords] = useState("");
  const [match, setMatch] = useState("contains");
  const [ref, setRef] = useState("");
  const [frequency, setFrequency] = useState("always");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const config =
        type === "KEYWORD"
          ? { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean), match }
          : type === "REF_LINK"
            ? { ref: ref.trim() }
            : type === "DEFAULT_REPLY"
              ? { frequency }
              : {};
      await api("/api/triggers", { body: { flowId, type, config } });
      onDone();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Start this flow when">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {TRIGGER_OPTIONS.map((o) => (
            <option key={o.type} value={o.type}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {type === "KEYWORD" && (
        <>
          <Field label="Keywords" hint="Separate several keywords with commas. Not case-sensitive.">
            <input className="input" autoFocus value={keywords} placeholder="pricing, price, cost" onChange={(e) => setKeywords(e.target.value)} />
          </Field>
          <Field label="Match when the message">
            <select className="input" value={match} onChange={(e) => setMatch(e.target.value)}>
              <option value="contains">contains the keyword</option>
              <option value="exact">is exactly the keyword</option>
              <option value="starts_with">starts with the keyword</option>
            </select>
          </Field>
        </>
      )}
      {type === "REF_LINK" && (
        <Field label="Link code" hint="Used in your links, e.g. t.me/yourbot?start=CODE. Find ready-made links in Growth Tools.">
          <input className="input" autoFocus value={ref} maxLength={40} placeholder="summer-sale" onChange={(e) => setRef(e.target.value)} />
        </Field>
      )}
      {type === "DEFAULT_REPLY" && (
        <Field label="How often" hint="Replaces your current default reply flow.">
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="always">Every time</option>
            <option value="daily">At most once a day per contact</option>
          </select>
        </Field>
      )}
      {type === "WELCOME" && <p className="text-xs leading-relaxed text-slate-500">Replaces your current welcome flow.</p>}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" loading={busy} onClick={save}>
          Add trigger
        </Button>
      </div>
    </div>
  );
}

function TriggerEditor() {
  const { triggers, flowId, refreshTriggers } = useBuilder();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <Section title="Triggers">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">Triggers decide when this flow starts. They only fire once the flow is published.</p>
      <div className="space-y-2">
        {triggers.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700">{describeTrigger(t)}</span>
            <Toggle
              label="Trigger enabled"
              checked={t.enabled}
              onChange={async (enabled) => {
                try {
                  await api(`/api/triggers/${t.id}`, { method: "PATCH", body: { enabled } });
                  refreshTriggers();
                } catch (err) {
                  toast(errorMessage(err), "error");
                }
              }}
            />
            <IconButton
              label="Delete trigger"
              onClick={async () => {
                try {
                  await api(`/api/triggers/${t.id}`, { method: "DELETE" });
                  refreshTriggers();
                } catch (err) {
                  toast(errorMessage(err), "error");
                }
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        ))}
        {adding ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
            <TriggerForm
              flowId={flowId}
              onCancel={() => setAdding(false)}
              onDone={() => {
                setAdding(false);
                refreshTriggers();
              }}
            />
          </div>
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add trigger</AddButton>
        )}
      </div>
    </Section>
  );
}

// ── Entry point ───────────────────────────────────────────────────────

export function NodeEditor({ kind, data, onChange }: { kind: NodeKind; data: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const change = onChange as Change<unknown>;
  switch (kind) {
    case "trigger":
      return <TriggerEditor />;
    case "message":
      return <MessageEditor data={data as unknown as MessageData} onChange={change} />;
    case "input":
      return <InputEditor data={data as unknown as InputData} onChange={change} />;
    case "condition":
      return <ConditionEditor data={data as unknown as ConditionData} onChange={change} />;
    case "action":
      return <ActionEditor data={data as unknown as ActionData} onChange={change} />;
    case "delay":
      return <DelayEditor data={data as unknown as DelayData} onChange={change} />;
    case "randomizer":
      return <RandomizerEditor data={data as unknown as RandomizerData} onChange={change} />;
    case "goto":
      return <GotoEditor data={data as unknown as GotoData} onChange={change} />;
  }
}

