"use client";

import clsx from "clsx";
import { CalendarClock, Megaphone, Plus, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Page } from "@/components/app/shell";
import { ChannelIcon } from "@/components/brand";
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Modal, PageHeader, PageLoader, useToast } from "@/components/ui";
import type { ChannelDTO } from "@/lib/channel-view";
import { api, errorMessage } from "@/lib/client";
import { formatDateTime, formatNumber } from "@/lib/format";

interface Broadcast {
  id: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED" | "FAILED";
  text: string | null;
  flow: { id: string; name: string } | null;
  scheduledAt: string | null;
  completedAt: string | null;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
}

const STATUS: Record<Broadcast["status"], { label: string; tone: "neutral" | "blue" | "amber" | "green" | "red" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "blue" },
  SENDING: { label: "Sending", tone: "amber" },
  SENT: { label: "Sent", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  FAILED: { label: "Failed", tone: "red" },
};

export default function BroadcastsPage() {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Broadcast | null>(null);
  const list = useSWR<{ broadcasts: Broadcast[] }>("/api/broadcasts", {
    refreshInterval: (data) => (data?.broadcasts.some((b) => b.status === "SENDING" || b.status === "SCHEDULED") ? 3000 : 0),
  });

  return (
    <Page>
      <PageHeader
        title="Broadcasts"
        description="Send a message or a whole flow to many contacts at once."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New broadcast
          </Button>
        }
      />

      {!list.data ? (
        <PageLoader />
      ) : list.data.broadcasts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="No broadcasts yet"
            action={
              <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                New broadcast
              </Button>
            }
          >
            Announce a sale, share news or re-engage quiet contacts. Target everyone or just the people with certain tags.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Broadcast</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 font-medium">When</th>
                  <th scope="col" className="px-3 py-3 font-medium">Delivery</th>
                  <th scope="col" className="w-24 px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.broadcasts.map((b) => {
                  const done = b.sent + b.failed;
                  const ratio = b.total > 0 ? Math.min(1, done / b.total) : 0;
                  return (
                    <tr key={b.id}>
                      <td className="max-w-[320px] px-5 py-3.5">
                        <div className="truncate font-medium text-ink">{b.name}</div>
                        <div className="mt-0.5 truncate text-[13px] text-slate-500">{b.flow ? `Flow: ${b.flow.name}` : b.text}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-[13px] text-slate-600">{formatDateTime(b.completedAt ?? b.scheduledAt ?? b.createdAt)}</td>
                      <td className="px-3 py-3.5">
                        {b.status === "SCHEDULED" ? (
                          <span className="tabular text-[13px] text-slate-600">~{formatNumber(b.total)} contacts</span>
                        ) : (
                          <div className="w-44">
                            <div className="tabular flex justify-between text-[13px] text-slate-700">
                              <span>
                                {formatNumber(b.sent)} of {formatNumber(b.total)} sent
                              </span>
                              {b.failed > 0 && <span className="text-rose-600">{formatNumber(b.failed)} failed</span>}
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {b.status === "SCHEDULED" || b.status === "SENDING" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api(`/api/broadcasts/${b.id}/cancel`, { method: "POST" });
                                void list.mutate();
                                toast("Broadcast cancelled");
                              } catch (err) {
                                toast(errorMessage(err), "error");
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <IconButton label={`Delete ${b.name}`} onClick={() => setDeleting(b)}>
                            <Trash2 className="size-4" />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <NewBroadcast
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void list.mutate();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this broadcast?"
        onConfirm={async () => {
          try {
            await api(`/api/broadcasts/${deleting!.id}`, { method: "DELETE" });
            void list.mutate();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        The record of &ldquo;{deleting?.name}&rdquo; will be removed. Messages already delivered stay in each conversation.
      </ConfirmDialog>
    </Page>
  );
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors",
        active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function NewBroadcast({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const channels = useSWR<{ channels: ChannelDTO[] }>("/api/channels");
  const tags = useSWR<{ tags: { id: string; name: string }[] }>("/api/tags");
  const flows = useSWR<{ flows: { id: string; name: string; status: string }[] }>("/api/flows");

  const [name, setName] = useState("");
  const [mode, setMode] = useState<"text" | "flow">("text");
  const [text, setText] = useState("");
  const [flowId, setFlowId] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<"any" | "all">("any");
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [reach, setReach] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const audience = useMemo(() => ({ channelIds, tagIds, tagMatch, excludeTagIds }), [channelIds, tagIds, tagMatch, excludeTagIds]);

  // Live audience size.
  useEffect(() => {
    let cancelled = false;
    setReach(null);
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ count: number }>("/api/broadcasts/audience", { body: { audience } });
        if (!cancelled) setReach(res.count);
      } catch {
        if (!cancelled) setReach(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience]);

  const toggleIn = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const live = (flows.data?.flows ?? []).filter((f) => f.status === "PUBLISHED");
  const hasWindowed = (channels.data?.channels ?? []).some((c) => ["WHATSAPP", "MESSENGER", "INSTAGRAM"].includes(c.type));
  const valid = name.trim() && (mode === "text" ? text.trim() : flowId) && (when === "now" || date) && (reach ?? 0) > 0;

  async function submit() {
    setBusy(true);
    try {
      await api("/api/broadcasts", {
        body: {
          name: name.trim(),
          text: mode === "text" ? text.trim() : undefined,
          flowId: mode === "flow" ? flowId : undefined,
          audience,
          scheduledAt: when === "later" ? new Date(date).toISOString() : undefined,
        },
      });
      toast(when === "later" ? "Broadcast scheduled" : "Broadcast is on its way");
      onCreated();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New broadcast"
      width={600}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 self-center text-[13px] text-slate-600" aria-live="polite">
            <Users className="size-4 text-slate-400" />
            {reach === null ? "Counting…" : <><span className="tabular font-semibold text-ink">{formatNumber(reach)}</span> contact{reach === 1 ? "" : "s"} will receive this</>}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!valid} onClick={submit} icon={when === "later" ? <CalendarClock className="size-4" /> : undefined}>
            {when === "later" ? "Schedule" : "Send now"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name" hint="Only you see this.">
          <input className="input" autoFocus value={name} maxLength={80} placeholder="e.g. Spring sale announcement" onChange={(e) => setName(e.target.value)} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">What to send</span>
          <div className="mb-2.5 flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-medium" role="group">
            {(
              [
                ["text", "A message"],
                ["flow", "A flow"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={clsx("flex-1 rounded-md px-2 py-1.5 transition-colors", mode === value ? "bg-white text-ink shadow-xs" : "text-slate-500")}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "text" ? (
            <Field hint="Personalize with {{first_name|there}}, {{email}} or any custom field key.">
              <textarea className="input min-h-28 resize-y leading-relaxed" value={text} maxLength={2000} placeholder="Hi {{first_name|there}}, our spring sale starts today…" onChange={(e) => setText(e.target.value)} />
            </Field>
          ) : (
            <Field hint={flows.data && live.length === 0 ? "Publish a flow first to broadcast it." : "Each contact starts this flow from its first step."}>
              <select className="input" value={flowId} onChange={(e) => setFlowId(e.target.value)} aria-label="Flow">
                <option value="">Choose a published flow…</option>
                {live.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Audience</span>
          <div className="space-y-3 rounded-xl border border-slate-200 p-3.5">
            <div>
              <div className="mb-1.5 text-xs text-slate-500">Channels {channelIds.length === 0 && "(all)"}</div>
              <div className="flex flex-wrap gap-1.5">
                {(channels.data?.channels ?? []).map((c) => (
                  <ChipToggle key={c.id} active={channelIds.includes(c.id)} onClick={() => toggleIn(channelIds, setChannelIds, c.id)}>
                    <ChannelIcon type={c.type} size={16} /> {c.name}
                  </ChipToggle>
                ))}
              </div>
            </div>
            {(tags.data?.tags.length ?? 0) > 0 && (
              <>
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
                    Has
                    <select className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-ink" aria-label="Tag match" value={tagMatch} onChange={(e) => setTagMatch(e.target.value as "any" | "all")}>
                      <option value="any">any</option>
                      <option value="all">all</option>
                    </select>
                    of these tags {tagIds.length === 0 && "(no tag filter)"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.data!.tags.map((t) => (
                      <ChipToggle key={t.id} active={tagIds.includes(t.id)} onClick={() => toggleIn(tagIds, setTagIds, t.id)}>
                        {t.name}
                      </ChipToggle>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-slate-500">But doesn&apos;t have</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.data!.tags.map((t) => (
                      <ChipToggle key={t.id} active={excludeTagIds.includes(t.id)} onClick={() => toggleIn(excludeTagIds, setExcludeTagIds, t.id)}>
                        {excludeTagIds.includes(t.id) && <X className="size-3" />} {t.name}
                      </ChipToggle>
                    ))}
                  </div>
                </div>
              </>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              Only subscribed contacts are included.
              {hasWindowed && " On WhatsApp, Messenger and Instagram, platform rules limit broadcasts to contacts who messaged you in the last 24 hours."}
            </p>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">When</span>
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle active={when === "now"} onClick={() => setWhen("now")}>
              Send now
            </ChipToggle>
            <ChipToggle active={when === "later"} onClick={() => setWhen("later")}>
              Schedule for later
            </ChipToggle>
            {when === "later" && (
              <input className="input w-auto" type="datetime-local" aria-label="Send at" value={date} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)} onChange={(e) => setDate(e.target.value)} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
