"use client";

import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { CopyField, QrCode } from "@/components/app/copy";
import { Page, useCanManage } from "@/components/app/shell";
import { ChannelIcon } from "@/components/brand";
import { Button, EmptyState, Field, IconButton, Modal, PageHeader, PageLoader, useToast } from "@/components/ui";
import type { ChannelDTO } from "@/lib/channel-view";
import { api, errorMessage } from "@/lib/client";

interface RefTrigger {
  id: string;
  type: string;
  enabled: boolean;
  config: { ref?: string };
  flow: { id: string; name: string; status: string };
}

export default function GrowthPage() {
  const channels = useSWR<{ channels: ChannelDTO[] }>("/api/channels");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const webchat = channels.data?.channels.find((c) => c.type === "WEBCHAT");

  return (
    <Page>
      <PageHeader title="Growth Tools" description="Bring people into chat: add the widget to your website, or share links and QR codes that start a flow." />
      {!channels.data || !origin ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {webchat && <WidgetTool channel={webchat} origin={origin} onSaved={() => void channels.mutate()} />}
          <LinksTool channels={channels.data.channels} />
        </div>
      )}
    </Page>
  );
}

function WidgetTool({ channel, origin, onSaved }: { channel: ChannelDTO; origin: string; onSaved: () => void }) {
  const toast = useToast();
  const canManage = useCanManage();
  const [form, setForm] = useState({
    title: channel.config.title ?? "",
    color: channel.config.color ?? "#6246EA",
    greeting: channel.config.greeting ?? "",
    placeholder: channel.config.placeholder ?? "",
    position: channel.config.position ?? "right",
  });
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const snippet = `<script src="${origin}/widget.js" data-channel="${channel.id}" async></script>`;
  const link = `${origin}/widget/${channel.id}`;
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== (channel.config[k] ?? ""));

  async function save() {
    setBusy(true);
    try {
      await api(`/api/channels/${channel.id}`, { method: "PATCH", body: { widget: form } });
      onSaved();
      setPreviewKey((k) => k + 1);
      toast("Widget updated");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <ChannelIcon type="WEBCHAT" size={36} className="rounded-xl" />
        <div>
          <h2 className="text-base font-semibold text-ink">Website chat widget</h2>
          <p className="text-[13px] text-slate-500">A chat bubble for your site. Visitors talk to your bot — and your team — without leaving the page.</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6 p-5">
          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">1. Add it to your website</h3>
            <p className="mb-2.5 text-[13px] leading-relaxed text-slate-500">
              Paste this just before the closing <code className="rounded bg-slate-100 px-1 font-mono text-xs">&lt;/body&gt;</code> tag on every page where the chat should appear.
            </p>
            <CopyField value={snippet} multiline />
          </div>

          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">2. Or share a direct chat link</h3>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <CopyField value={link} />
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                  Open full-page chat <ExternalLink className="size-3.5" />
                </a>
              </div>
              <QrCode value={link} size={104} />
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink">3. Make it yours</h3>
            <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input className="input" value={form.title} maxLength={60} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Brand colour">
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Pick colour"
                    value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : "#6246ea"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-[38px] w-12 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <input className="input font-mono" value={form.color} maxLength={7} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
              </Field>
              <Field label="Greeting" hint="Shown before the visitor writes anything." className="sm:col-span-2">
                <input className="input" value={form.greeting} maxLength={300} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
              </Field>
              <Field label="Input placeholder">
                <input className="input" value={form.placeholder} maxLength={80} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} />
              </Field>
              <Field label="Bubble position">
                <select className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </Field>
            </fieldset>
            {canManage ? (
              <Button className="mt-4" loading={busy} disabled={!dirty} onClick={save}>
                Save changes
              </Button>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Only admins can change the widget&apos;s appearance.</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-canvas p-5 lg:border-l lg:border-t-0">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Live preview</div>
          <iframe key={previewKey} src={`/widget/${channel.id}`} title="Widget preview" className="h-[520px] w-full rounded-2xl border border-slate-200 bg-white shadow-card" />
        </div>
      </div>
    </section>
  );
}

function LinksTool({ channels }: { channels: ChannelDTO[] }) {
  const toast = useToast();
  const triggers = useSWR<{ triggers: RefTrigger[] }>("/api/triggers");
  const flows = useSWR<{ flows: { id: string; name: string; status: string }[] }>("/api/flows");
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [flowId, setFlowId] = useState("");
  const [busy, setBusy] = useState(false);

  const telegram = channels.filter((c) => c.type === "TELEGRAM" && c.config.username);
  const messenger = channels.filter((c) => c.type === "MESSENGER" && c.config.pageId);
  const whatsapp = channels.filter((c) => c.type === "WHATSAPP" && c.config.phone);
  const links = (triggers.data?.triggers ?? []).filter((t) => t.type === "REF_LINK");
  const supported = telegram.length + messenger.length > 0;

  function urlsFor(code: string) {
    return [
      ...telegram.map((c) => ({ channel: c, url: `https://t.me/${c.config.username}?start=${encodeURIComponent(code)}` })),
      ...messenger.map((c) => ({ channel: c, url: `https://m.me/${c.config.pageId}?ref=${encodeURIComponent(code)}` })),
    ];
  }

  async function create() {
    setBusy(true);
    try {
      await api("/api/triggers", { body: { type: "REF_LINK", flowId, config: { ref: ref.trim() } } });
      setOpen(false);
      setRef("");
      setFlowId("");
      void triggers.mutate();
      toast("Link created");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Link2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">Links &amp; QR codes</h2>
          <p className="text-[13px] text-slate-500">Each link opens your bot and starts a specific flow — perfect for ads, emails, packaging and posters.</p>
        </div>
        <Button variant="subtle" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
          New link
        </Button>
      </div>

      {!triggers.data ? (
        <PageLoader />
      ) : (
        <div className="divide-y divide-slate-100">
          {!supported && (
            <div className="bg-amber-50 px-5 py-3 text-[13px] leading-relaxed text-amber-900">
              Flow links work with Telegram and Messenger.{" "}
              <Link href="/app/settings?tab=channels" className="font-semibold underline underline-offset-2">
                Connect one of them
              </Link>{" "}
              to get shareable links here.
            </div>
          )}
          {links.length === 0 ? (
            <EmptyState icon={<Link2 className="size-5" />} title="No links yet">
              Create a link, choose the flow it should start, and share it anywhere.
            </EmptyState>
          ) : (
            links.map((t) => {
              const urls = urlsFor(t.config.ref ?? "");
              return (
                <div key={t.id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[13px] font-medium text-ink">{t.config.ref}</code>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
                      starts{" "}
                      <Link href={`/app/automation/flows/${t.flow.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                        {t.flow.name}
                      </Link>
                      {t.flow.status !== "PUBLISHED" && <span className="ml-1.5 text-amber-700">(not published)</span>}
                    </span>
                    <IconButton
                      label="Delete link"
                      onClick={async () => {
                        try {
                          await api(`/api/triggers/${t.id}`, { method: "DELETE" });
                          void triggers.mutate();
                        } catch (err) {
                          toast(errorMessage(err), "error");
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                  {urls.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {urls.map(({ channel, url }) => (
                        <div key={channel.id} className="flex flex-wrap items-center gap-3">
                          <QrCode value={url} size={64} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <ChannelIcon type={channel.type} size={16} /> {channel.name}
                            </div>
                            <CopyField value={url} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {whatsapp.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">WhatsApp click-to-chat</h3>
              <p className="mb-3 mt-1 text-[13px] leading-relaxed text-slate-500">
                WhatsApp links pre-fill a message. Add a keyword after <code className="rounded bg-slate-100 px-1 font-mono text-xs">text=</code> that matches one of your{" "}
                <Link href="/app/automation?tab=keywords" className="font-medium text-brand-700 hover:underline">
                  keyword triggers
                </Link>{" "}
                to start that flow.
              </p>
              {whatsapp.map((c) => (
                <CopyField key={c.id} value={`https://wa.me/${c.config.phone.replace(/\D/g, "")}?text=hello`} />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New link"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!ref.trim() || !flowId} onClick={create}>
              Create link
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Link code" hint="Letters, numbers, dashes and underscores. It appears in the link, e.g. summer-sale.">
            <input className="input font-mono" autoFocus value={ref} maxLength={40} placeholder="summer-sale" onChange={(e) => setRef(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} />
          </Field>
          <Field label="Flow to start">
            <select className="input" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
              <option value="">Choose a flow…</option>
              {(flows.data?.flows ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.status !== "PUBLISHED" ? " (draft)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </section>
  );
}
