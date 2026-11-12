"use client";

import { Copy, Ellipsis, Hand, KeyRound, LayoutTemplate, MessageCircleQuestion, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { Page } from "@/components/app/shell";
import { describeTrigger, type TriggerSummary } from "@/components/flow/context";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  PageHeader,
  PageLoader,
  Tabs,
  Toggle,
  buttonClass,
  useToast,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { formatNumber, timeAgo } from "@/lib/format";

interface FlowRow {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  runCount: number;
  updatedAt: string;
  triggers: TriggerSummary[];
}

interface TriggerRow extends TriggerSummary {
  flow: { id: string; name: string; status: string };
}

type Tab = "flows" | "keywords" | "basics";

export default function AutomationPage() {
  return (
    <Suspense>
      <Automation />
    </Suspense>
  );
}

function Automation() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (["flows", "keywords", "basics"].includes(params.get("tab") ?? "") ? params.get("tab") : "flows") as Tab;
  const flows = useSWR<{ flows: FlowRow[] }>("/api/flows");
  const triggers = useSWR<{ triggers: TriggerRow[] }>("/api/triggers");
  const [creating, setCreating] = useState(false);
  const keywordCount = triggers.data?.triggers.filter((t) => t.type === "KEYWORD").length;

  const refresh = () => {
    void flows.mutate();
    void triggers.mutate();
  };

  return (
    <Page>
      <PageHeader
        title="Automation"
        description="Flows are the conversations your bot can have. Triggers decide when each one starts."
        actions={
          <>
            <Link href="/app/templates" className={buttonClass("secondary")}>
              <LayoutTemplate className="size-4" /> Templates
            </Link>
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New flow
            </Button>
          </>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={(id) => router.replace(id === "flows" ? "/app/automation" : `/app/automation?tab=${id}`)}
        tabs={[
          { id: "flows", label: "Flows", count: flows.data?.flows.length },
          { id: "keywords", label: "Keywords", count: keywordCount },
          { id: "basics", label: "Welcome & default reply" },
        ]}
      />
      <div className="mt-5">
        {!flows.data || !triggers.data ? (
          <PageLoader />
        ) : tab === "flows" ? (
          <FlowsTab flows={flows.data.flows} refresh={refresh} onCreate={() => setCreating(true)} />
        ) : tab === "keywords" ? (
          <KeywordsTab triggers={triggers.data.triggers.filter((t) => t.type === "KEYWORD")} flows={flows.data.flows} refresh={refresh} />
        ) : (
          <BasicsTab triggers={triggers.data.triggers} flows={flows.data.flows} refresh={refresh} />
        )}
      </div>
      <NewFlowModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}

function NewFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/flows", { body: { name: name.trim() || "Untitled flow" } });
      router.push(`/app/automation/flows/${res.id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New flow"
      description="Start with a blank canvas. You can add a trigger and publish when it's ready."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={create}>
            Create flow
          </Button>
        </>
      }
    >
      <Field label="Flow name">
        <input
          className="input"
          autoFocus
          value={name}
          maxLength={80}
          placeholder="e.g. Pricing questions"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
        />
      </Field>
    </Modal>
  );
}

function FlowsTab({ flows, refresh, onCreate }: { flows: FlowRow[]; refresh: () => void; onCreate: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState<FlowRow | null>(null);

  if (flows.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Workflow className="size-5" />}
          title="No flows yet"
          action={
            <Button icon={<Plus className="size-4" />} onClick={onCreate}>
              New flow
            </Button>
          }
        >
          Build your first conversation from scratch, or start from a ready-made template.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Flow</th>
              <th scope="col" className="px-3 py-3 font-medium">Starts when</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Runs</th>
              <th scope="col" className="px-3 py-3 font-medium">Edited</th>
              <th scope="col" className="w-12 px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flows.map((flow) => (
              <tr key={flow.id} className="group hover:bg-slate-50/70">
                <td className="px-5 py-3.5">
                  <Link href={`/app/automation/flows/${flow.id}`} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Workflow className="size-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink group-hover:text-brand-700">{flow.name}</span>
                      <span className="mt-0.5 block">{flow.status === "PUBLISHED" ? <Badge tone="green">Live</Badge> : <Badge>Draft</Badge>}</span>
                    </span>
                  </Link>
                </td>
                <td className="max-w-[280px] px-3 py-3.5 text-[13px] text-slate-600">
                  {flow.triggers.length === 0 ? (
                    <span className="text-slate-400">No trigger</span>
                  ) : (
                    <span className="line-clamp-2">{flow.triggers.map(describeTrigger).join(" · ")}</span>
                  )}
                </td>
                <td className="tabular px-3 py-3.5 text-right text-slate-700">{formatNumber(flow.runCount)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-[13px] text-slate-500">{timeAgo(flow.updatedAt)}</td>
                <td className="px-3 py-3.5 text-right">
                  <Menu
                    trigger={(props) => (
                      <IconButton label={`Actions for ${flow.name}`} {...props}>
                        <Ellipsis className="size-4.5" />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Pencil />}
                          onClick={() => {
                            close();
                            router.push(`/app/automation/flows/${flow.id}`);
                          }}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem
                          icon={<Copy />}
                          onClick={async () => {
                            close();
                            try {
                              await api(`/api/flows/${flow.id}/duplicate`, { method: "POST" });
                              refresh();
                              toast("Flow duplicated");
                            } catch (err) {
                              toast(errorMessage(err), "error");
                            }
                          }}
                        >
                          Duplicate
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 />}
                          danger
                          onClick={() => {
                            close();
                            setDeleting(flow);
                          }}
                        >
                          Delete
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this flow?"
        onConfirm={async () => {
          try {
            await api(`/api/flows/${deleting!.id}`, { method: "DELETE" });
            refresh();
            toast("Flow deleted");
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        &ldquo;{deleting?.name}&rdquo; and its triggers will be removed permanently. Contacts currently in this flow will stop receiving it.
      </ConfirmDialog>
    </div>
  );
}

function FlowSelect({ flows, value, onChange }: { flows: FlowRow[]; value: string; onChange: (id: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Flow">
      <option value="">Choose a flow…</option>
      {flows.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
          {f.status !== "PUBLISHED" ? " (draft)" : ""}
        </option>
      ))}
    </select>
  );
}

function KeywordsTab({ triggers, flows, refresh }: { triggers: TriggerRow[]; flows: FlowRow[]; refresh: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [match, setMatch] = useState("contains");
  const [flowId, setFlowId] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api("/api/triggers", {
        body: { type: "KEYWORD", flowId, config: { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean), match } },
      });
      setOpen(false);
      setKeywords("");
      setFlowId("");
      refresh();
      toast("Keyword added");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="max-w-xl text-[13px] leading-relaxed text-slate-500">
            When a contact&apos;s message matches a keyword, the linked flow starts. Exact matches win over &ldquo;starts with&rdquo;, which win over &ldquo;contains&rdquo;.
          </p>
          <Button variant="subtle" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            New keyword
          </Button>
        </div>
        {triggers.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-5" />} title="No keywords yet">
            Add words like &ldquo;pricing&rdquo; or &ldquo;help&rdquo; and choose which flow should answer.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {triggers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(t.config.keywords ?? []).map((k) => (
                      <Badge key={k} tone="brand" className="text-[13px]">
                        {k}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[13px] text-slate-500">
                    Message {t.config.match === "exact" ? "is exactly" : t.config.match === "starts_with" ? "starts with" : "contains"} the keyword →{" "}
                    <Link href={`/app/automation/flows/${t.flow.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                      {t.flow.name}
                    </Link>
                    {t.flow.status !== "PUBLISHED" && <span className="ml-1.5 text-amber-700">(flow not published)</span>}
                  </div>
                </div>
                <Toggle
                  label="Keyword enabled"
                  checked={t.enabled}
                  onChange={async (enabled) => {
                    try {
                      await api(`/api/triggers/${t.id}`, { method: "PATCH", body: { enabled } });
                      refresh();
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                />
                <IconButton
                  label="Delete keyword"
                  onClick={async () => {
                    try {
                      await api(`/api/triggers/${t.id}`, { method: "DELETE" });
                      refresh();
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New keyword"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!keywords.trim() || !flowId} onClick={create}>
              Add keyword
            </Button>
          </>
        }
      >
        <div className="space-y-4">
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
          <Field label="Then start this flow">
            <FlowSelect flows={flows} value={flowId} onChange={setFlowId} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function BasicsTab({ triggers, flows, refresh }: { triggers: TriggerRow[]; flows: FlowRow[]; refresh: () => void }) {
  const toast = useToast();
  const cards = [
    {
      type: "WELCOME" as const,
      icon: Hand,
      title: "Welcome message",
      body: "Sent the first time someone messages you, unless a keyword matches first.",
    },
    {
      type: "DEFAULT_REPLY" as const,
      icon: MessageCircleQuestion,
      title: "Default reply",
      body: "Sent when a message doesn't match any keyword and no flow is waiting for an answer.",
    },
  ];

  async function setFlow(type: "WELCOME" | "DEFAULT_REPLY", flowId: string, existing?: TriggerRow) {
    try {
      if (!flowId) {
        if (existing) await api(`/api/triggers/${existing.id}`, { method: "DELETE" });
      } else {
        await api("/api/triggers", {
          body: { type, flowId, config: type === "DEFAULT_REPLY" ? { frequency: existing?.config.frequency ?? "always" } : {} },
        });
      }
      refresh();
      toast("Saved");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => {
        const trigger = triggers.find((t) => t.type === card.type);
        const Icon = card.icon;
        return (
          <section key={card.type} className="card p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-sans text-[15px] font-semibold tracking-normal text-ink">{card.title}</h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{card.body}</p>
              </div>
              {trigger && (
                <Toggle
                  label={`${card.title} enabled`}
                  checked={trigger.enabled}
                  onChange={async (enabled) => {
                    try {
                      await api(`/api/triggers/${trigger.id}`, { method: "PATCH", body: { enabled } });
                      refresh();
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                />
              )}
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Flow to send">
                <select className="input" value={trigger?.flow.id ?? ""} onChange={(e) => void setFlow(card.type, e.target.value, trigger)}>
                  <option value="">None (turned off)</option>
                  {flows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.status !== "PUBLISHED" ? " (draft)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {trigger && card.type === "DEFAULT_REPLY" && (
                <Field label="How often">
                  <select
                    className="input"
                    value={trigger.config.frequency ?? "always"}
                    onChange={async (e) => {
                      try {
                        await api(`/api/triggers/${trigger.id}`, { method: "PATCH", body: { config: { frequency: e.target.value } } });
                        refresh();
                      } catch (err) {
                        toast(errorMessage(err), "error");
                      }
                    }}
                  >
                    <option value="always">Every time</option>
                    <option value="daily">At most once a day per contact</option>
                  </select>
                </Field>
              )}
              {trigger && (
                <div className="flex items-center justify-between pt-1">
                  {trigger.flow.status !== "PUBLISHED" ? <Badge tone="amber">Flow not published — won&apos;t send</Badge> : <span />}
                  <Link href={`/app/automation/flows/${trigger.flow.id}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
                    Edit flow
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
