"use client";

import { ChevronDown, CircleAlert, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { CopyField } from "@/components/app/copy";
import { useCanManage, useMe } from "@/components/app/shell";
import { ChannelIcon, channelLabel, type ChannelKind } from "@/components/brand";
import { Badge, Button, ConfirmDialog, Field, IconButton, Modal, PageLoader, Toggle, useToast } from "@/components/ui";
import type { ChannelDTO } from "@/lib/channel-view";
import { api, errorMessage } from "@/lib/client";
import { formatNumber } from "@/lib/format";

type Connectable = Exclude<ChannelKind, "WEBCHAT">;

const CONNECT: Record<Connectable, { blurb: string; steps: ReactNode[]; fields: { key: string; label: string; hint?: string; secret?: boolean; placeholder?: string }[] }> = {
  TELEGRAM: {
    blurb: "Automate a Telegram bot. Takes about a minute.",
    steps: [
      <>Open Telegram and start a chat with <strong>@BotFather</strong>.</>,
      <>Send <code>/newbot</code> and follow the prompts (or <code>/token</code> for a bot you already have).</>,
      <>Copy the bot token BotFather gives you and paste it below.</>,
    ],
    fields: [{ key: "token", label: "Bot token", secret: true, placeholder: "123456789:AAH…" }],
  },
  WHATSAPP: {
    blurb: "Connect a WhatsApp Business number through the WhatsApp Cloud API.",
    steps: [
      <>In <strong>Meta for Developers</strong>, create a Business app and add the <strong>WhatsApp</strong> product.</>,
      <>Under WhatsApp → API Setup, copy the <strong>Phone number ID</strong>.</>,
      <>Create a permanent <strong>system user access token</strong> with the <code>whatsapp_business_messaging</code> permission.</>,
      <>Copy the <strong>App secret</strong> from App settings → Basic.</>,
    ],
    fields: [
      { key: "phoneNumberId", label: "Phone number ID", placeholder: "1029384756123" },
      { key: "token", label: "Access token", secret: true },
      { key: "appSecret", label: "App secret", secret: true, hint: "Used to verify that incoming messages really come from Meta." },
    ],
  },
  MESSENGER: {
    blurb: "Reply to people who message your Facebook Page.",
    steps: [
      <>In <strong>Meta for Developers</strong>, create a Business app and add the <strong>Messenger</strong> product.</>,
      <>Link your Facebook Page and generate a <strong>Page access token</strong>.</>,
      <>Copy the <strong>App secret</strong> from App settings → Basic.</>,
    ],
    fields: [
      { key: "token", label: "Page access token", secret: true },
      { key: "appSecret", label: "App secret", secret: true },
    ],
  },
  INSTAGRAM: {
    blurb: "Automate Instagram DMs for a professional account.",
    steps: [
      <>Make sure your Instagram <strong>professional account</strong> is linked to a Facebook Page.</>,
      <>In <strong>Meta for Developers</strong>, add the <strong>Instagram</strong> messaging product to your app.</>,
      <>Generate a <strong>Page access token</strong> for the linked Page with <code>instagram_manage_messages</code>.</>,
      <>Copy the <strong>App secret</strong> from App settings → Basic.</>,
    ],
    fields: [
      { key: "token", label: "Page access token", secret: true },
      { key: "appSecret", label: "App secret", secret: true },
    ],
  },
};

const WEBHOOK_FIELDS: Record<string, string> = {
  WHATSAPP: "messages",
  MESSENGER: "messages, messaging_postbacks, messaging_referrals",
  INSTAGRAM: "messages, messaging_postbacks",
};

function WebhookSetup({ channel }: { channel: ChannelDTO }) {
  if (!channel.webhook) return null;
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-slate-600">
      <p>
        In your Meta app, open <strong>Webhooks</strong> for {channelLabel(channel.type)}, click <strong>Edit subscription</strong> and enter:
      </p>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">Callback URL</div>
        <CopyField value={channel.webhook.url} />
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">Verify token</div>
        <CopyField value={channel.webhook.verifyToken} />
      </div>
      <p>
        Then subscribe to these fields: <code className="rounded bg-slate-100 px-1 font-mono text-xs">{WEBHOOK_FIELDS[channel.type]}</code>
      </p>
    </div>
  );
}

export function ChannelsSettings() {
  const toast = useToast();
  const canManage = useCanManage();
  const { me, refresh } = useMe();
  const { data, mutate } = useSWR<{ channels: ChannelDTO[] }>("/api/channels");
  const [connecting, setConnecting] = useState<Connectable | null>(null);
  const [justConnected, setJustConnected] = useState<ChannelDTO | null>(null);
  const [removing, setRemoving] = useState<ChannelDTO | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data) return <PageLoader />;

  async function patch(id: string, body: Record<string, unknown>, done: string) {
    try {
      await api(`/api/channels/${id}`, { method: "PATCH", body });
      await mutate();
      toast(done);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const atLimit = me.usage.channels >= me.limits.channels;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Connected channels</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Every channel shares the same flows, contacts and inbox.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {data.channels.map((c) => (
            <li key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <ChannelIcon type={c.type} size={40} className="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                    {c.status === "ACTIVE" && <Badge tone="green">Active</Badge>}
                    {c.status === "DISABLED" && <Badge>Paused</Badge>}
                    {c.status === "ERROR" && <Badge tone="red">Needs attention</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    {channelLabel(c.type)}
                    {c.config.username ? ` · @${c.config.username}` : c.config.phone ? ` · ${c.config.phone}` : ""} · {formatNumber(c.contacts)} contact{c.contacts === 1 ? "" : "s"}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    {c.webhook && (
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === c.id ? null : c.id)} aria-expanded={expanded === c.id}>
                        Webhook <ChevronDown className={`size-4 transition-transform ${expanded === c.id ? "rotate-180" : ""}`} />
                      </Button>
                    )}
                    {c.type === "TELEGRAM" && c.status === "ERROR" && (
                      <Button variant="secondary" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={() => patch(c.id, { reconnect: true }, "Telegram reconnected")}>
                        Reconnect
                      </Button>
                    )}
                    {c.status !== "ERROR" && (
                      <Toggle
                        label={`${c.name} enabled`}
                        checked={c.status === "ACTIVE"}
                        onChange={(on) => patch(c.id, { status: on ? "ACTIVE" : "DISABLED" }, on ? "Channel resumed" : "Channel paused")}
                      />
                    )}
                    {c.type !== "WEBCHAT" && (
                      <IconButton label={`Remove ${c.name}`} onClick={() => setRemoving(c)} className="hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>
                )}
              </div>
              {c.lastError && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] leading-relaxed text-rose-700">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" /> {c.lastError}
                </p>
              )}
              {expanded === c.id && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <WebhookSetup channel={c} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <section>
          <h2 className="mb-1 text-base font-semibold text-ink">Add a channel</h2>
          <p className="mb-3 text-[13px] text-slate-500">
            {atLimit
              ? `Your ${me.workspace.plan === "FREE" ? "Free" : "current"} plan includes ${me.limits.channels} messaging channel${me.limits.channels === 1 ? "" : "s"} besides website chat. Upgrade to connect more.`
              : "Connect the messaging apps your customers already use."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(CONNECT) as Connectable[]).map((type) => (
              <button
                key={type}
                type="button"
                disabled={atLimit}
                onClick={() => setConnecting(type)}
                className="card flex items-center gap-3.5 p-4 text-left transition hover:border-brand-300 hover:shadow-pop disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-card"
              >
                <ChannelIcon type={type} size={44} className="rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{channelLabel(type)}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{CONNECT[type].blurb}</span>
                </span>
                <Plus className="size-5 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      )}

      {connecting && (
        <ConnectModal
          type={connecting}
          onClose={() => setConnecting(null)}
          onConnected={(channel) => {
            setConnecting(null);
            void mutate();
            refresh();
            if (channel.webhook) setJustConnected(channel);
            else toast(channel.status === "ERROR" ? "Connected, but the webhook needs attention" : `${channelLabel(channel.type)} connected`, channel.status === "ERROR" ? "error" : "success");
          }}
        />
      )}

      <Modal
        open={!!justConnected}
        onClose={() => setJustConnected(null)}
        title="One last step: add the webhook"
        description="This tells Meta where to deliver incoming messages. You can find these details again under Webhook."
        footer={<Button onClick={() => setJustConnected(null)}>Done</Button>}
      >
        {justConnected && <WebhookSetup channel={justConnected} />}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        confirmLabel="Remove channel"
        onConfirm={async () => {
          try {
            await api(`/api/channels/${removing!.id}`, { method: "DELETE" });
            await mutate();
            refresh();
            toast("Channel removed");
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        This disconnects the channel and permanently deletes its {formatNumber(removing?.contacts ?? 0)} contact{removing?.contacts === 1 ? "" : "s"} and their conversations.
      </ConfirmDialog>
    </div>
  );
}

function ConnectModal({ type, onClose, onConnected }: { type: Connectable; onClose: () => void; onConnected: (channel: ChannelDTO) => void }) {
  const spec = CONNECT[type];
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = spec.fields.every((f) => (values[f.key] ?? "").trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { type };
      for (const f of spec.fields) body[f.key] = values[f.key].trim();
      const res = await api<{ channel: ChannelDTO }>("/api/channels", { body });
      onConnected(res.channel);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Connect ${channelLabel(type)}`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!complete} onClick={submit}>
            Connect
          </Button>
        </>
      }
    >
      <ol className="mb-5 space-y-2.5 text-[13px] leading-relaxed text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_strong]:font-semibold [&_strong]:text-ink">
        {spec.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        {spec.fields.map((f, i) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input
              className="input font-mono"
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              autoFocus={i === 0}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">Credentials are encrypted before they are stored and are never shown again.</p>
    </Modal>
  );
}
