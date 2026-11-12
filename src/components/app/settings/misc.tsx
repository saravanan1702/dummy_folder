"use client";

import { KeyRound, Pencil, Plus, Tag, TextCursorInput, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { CopyField, useOrigin } from "@/components/app/copy";
import { useCanManage, useMe } from "@/components/app/shell";
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Modal, PageLoader, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";

function Card({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── General ───────────────────────────────────────────────────────────

export function GeneralSettings() {
  const toast = useToast();
  const canManage = useCanManage();
  const { me, refresh } = useMe();
  const [name, setName] = useState(me.workspace.name);
  const [timezone, setTimezone] = useState(me.workspace.timezone);
  const [takeover, setTakeover] = useState(me.workspace.takeoverMinutes);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    try {
      return ["UTC", ...Intl.supportedValuesOf("timeZone")];
    } catch {
      return ["UTC"];
    }
  }, []);
  const dirty = name !== me.workspace.name || timezone !== me.workspace.timezone || takeover !== me.workspace.takeoverMinutes;

  return (
    <Card title="Workspace" description="Basic details about this workspace.">
      <fieldset disabled={!canManage} className="max-w-lg space-y-4 p-5">
        <Field label="Workspace name">
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Time zone">
          <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pause the bot after a teammate replies" hint="Keeps automation from talking over your team in Live Chat. Set to 0 to never pause.">
          <div className="flex items-center gap-2">
            <input className="input w-24" type="number" min={0} max={1440} value={takeover} onChange={(e) => setTakeover(Math.min(1440, Math.max(0, Math.round(Number(e.target.value)) || 0)))} />
            <span className="text-sm text-slate-600">minutes</span>
          </div>
        </Field>
        {canManage ? (
          <Button
            loading={busy}
            disabled={!dirty || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/workspace", { method: "PATCH", body: { name: name.trim(), timezone, takeoverMinutes: takeover } });
                refresh();
                toast("Workspace updated");
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save changes
          </Button>
        ) : (
          <p className="text-[13px] text-slate-500">Only admins can change workspace settings.</p>
        )}
      </fieldset>
    </Card>
  );
}

// ── Tags ──────────────────────────────────────────────────────────────

interface TagRow {
  id: string;
  name: string;
  contacts: number;
}

export function TagsSettings() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ tags: TagRow[] }>("/api/tags");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<TagRow | null>(null);

  async function create() {
    if (!name.trim()) return;
    try {
      await api("/api/tags", { body: { name } });
      setName("");
      void mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <Card title="Tags" description="Labels for segmenting contacts. Add them by hand, in bulk, or automatically from a flow.">
      <div className="flex gap-2 border-b border-slate-100 p-4">
        <input className="input max-w-xs" value={name} maxLength={50} placeholder="New tag name" aria-label="New tag name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
        <Button icon={<Plus className="size-4" />} disabled={!name.trim()} onClick={create}>
          Add tag
        </Button>
      </div>
      {!data ? (
        <PageLoader />
      ) : data.tags.length === 0 ? (
        <EmptyState icon={<Tag className="size-5" />} title="No tags yet">
          Create tags like &ldquo;Lead&rdquo; or &ldquo;VIP&rdquo; to group contacts and target broadcasts.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.tags.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
              <Badge tone="brand" className="text-[13px]">
                {t.name}
              </Badge>
              <span className="tabular flex-1 text-[13px] text-slate-500">
                {formatNumber(t.contacts)} contact{t.contacts === 1 ? "" : "s"}
              </span>
              <IconButton
                label={`Rename ${t.name}`}
                onClick={() => {
                  setEditing(t);
                  setEditName(t.name);
                }}
              >
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={`Delete ${t.name}`} onClick={() => setDeleting(t)} className="hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Rename tag"
        width={400}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim()}
              onClick={async () => {
                try {
                  await api(`/api/tags/${editing!.id}`, { method: "PATCH", body: { name: editName } });
                  setEditing(null);
                  void mutate();
                } catch (err) {
                  toast(errorMessage(err), "error");
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <input className="input" autoFocus aria-label="Tag name" value={editName} maxLength={50} onChange={(e) => setEditName(e.target.value)} />
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete the tag "${deleting?.name}"?`}
        onConfirm={async () => {
          try {
            await api(`/api/tags/${deleting!.id}`, { method: "DELETE" });
            void mutate();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        It will be removed from {formatNumber(deleting?.contacts ?? 0)} contact{deleting?.contacts === 1 ? "" : "s"}. Flows and broadcasts that use it will stop matching.
      </ConfirmDialog>
    </Card>
  );
}

// ── Custom fields ─────────────────────────────────────────────────────

interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: string;
}

export function FieldsSettings() {
  const toast = useToast();
  const canManage = useCanManage();
  const { data, mutate } = useSWR<{ fields: FieldRow[] }>("/api/fields");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("TEXT");
  const [deleting, setDeleting] = useState<FieldRow | null>(null);

  async function create() {
    if (!label.trim()) return;
    try {
      await api("/api/fields", { body: { label, type } });
      setLabel("");
      void mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <Card title="Custom fields" description="Extra details you want to store about each contact, such as company or order number. Flows can save answers into them.">
      {canManage && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <input className="input max-w-xs" value={label} maxLength={60} placeholder="Field name, e.g. Company" aria-label="Field name" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
          <select className="input w-auto" aria-label="Field type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="TEXT">Text</option>
            <option value="NUMBER">Number</option>
            <option value="BOOLEAN">Yes / No</option>
            <option value="DATE">Date</option>
          </select>
          <Button icon={<Plus className="size-4" />} disabled={!label.trim()} onClick={create}>
            Add field
          </Button>
        </div>
      )}
      {!data ? (
        <PageLoader />
      ) : data.fields.length === 0 ? (
        <EmptyState icon={<TextCursorInput className="size-5" />} title="No custom fields yet">
          Name, email and phone are built in. Add fields for anything else you collect.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.fields.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{f.label}</span>
                <span className="block text-xs text-slate-500">
                  Use in messages as <code className="rounded bg-slate-100 px-1 font-mono">{`{{${f.key}}}`}</code>
                </span>
              </span>
              <Badge>{f.type === "BOOLEAN" ? "Yes / No" : f.type.charAt(0) + f.type.slice(1).toLowerCase()}</Badge>
              {canManage && (
                <IconButton label={`Delete ${f.label}`} onClick={() => setDeleting(f)} className="hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete the field "${deleting?.label}"?`}
        onConfirm={async () => {
          try {
            await api(`/api/fields/${deleting!.id}`, { method: "DELETE" });
            void mutate();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        The field disappears from contact profiles and flow editors. Values already saved on contacts are kept in case you add it again.
      </ConfirmDialog>
    </Card>
  );
}

// ── API keys ──────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiSettings() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ keys: ApiKeyRow[]; available: boolean }>("/api/api-keys");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const origin = useOrigin();

  function close() {
    setCreating(false);
    setSecret(null);
    setName("");
  }

  return (
    <div className="space-y-6">
      <Card
        title="API keys"
        description="Let your own systems read contacts, add tags, send messages and start flows."
        action={
          <Button icon={<Plus className="size-4" />} disabled={data ? !data.available : true} onClick={() => setCreating(true)}>
            New API key
          </Button>
        }
      >
        {!data ? (
          <PageLoader />
        ) : !data.available ? (
          <EmptyState icon={<KeyRound className="size-5" />} title="The REST API is a Pro feature">
            Upgrade to Pro or Business to create API keys and connect your own tools.
          </EmptyState>
        ) : data.keys.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-5" />} title="No API keys yet">
            Create a key to start calling the API from your backend.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{k.name}</span>
                  <span className="block text-xs text-slate-500">
                    <code className="font-mono">{k.prefix}…</code> · created {formatDate(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)} ago` : "never used"}
                  </span>
                </span>
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setRevoking(k)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Quick reference" description="Send your key as a Bearer token. All endpoints return JSON.">
        <div className="space-y-4 p-5">
          {[
            ["List contacts", `curl ${origin}/api/v1/contacts \\\n  -H "Authorization: Bearer YOUR_API_KEY"`],
            ["Tag a contact", `curl -X POST ${origin}/api/v1/contacts/CONTACT_ID/tags \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"tag": "Customer"}'`],
            ["Send a message", `curl -X POST ${origin}/api/v1/contacts/CONTACT_ID/messages \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text": "Your order has shipped!"}'`],
            ["Start a flow", `curl -X POST ${origin}/api/v1/contacts/CONTACT_ID/flows \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"flow_id": "FLOW_ID"}'`],
          ].map(([title, code]) => (
            <div key={title}>
              <div className="mb-1.5 text-[13px] font-medium text-slate-700">{title}</div>
              <CopyField value={code} multiline />
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={creating}
        onClose={close}
        title={secret ? "Copy your API key" : "New API key"}
        footer={
          secret ? (
            <Button onClick={close}>I&apos;ve saved it</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                loading={busy}
                disabled={!name.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await api<{ key: string }>("/api/api-keys", { body: { name } });
                    setSecret(res.key);
                    void mutate();
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Create key
              </Button>
            </>
          )
        }
      >
        {secret ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600">This is the only time the full key is shown. Store it somewhere safe, like a password manager.</p>
            <CopyField value={secret} multiline />
          </div>
        ) : (
          <Field label="Key name" hint="For your reference, e.g. the system that will use it.">
            <input className="input" autoFocus value={name} maxLength={60} placeholder="e.g. Shop backend" onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
      </Modal>
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke "${revoking?.name}"?`}
        confirmLabel="Revoke key"
        onConfirm={async () => {
          try {
            await api(`/api/api-keys/${revoking!.id}`, { method: "DELETE" });
            void mutate();
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        Anything using this key will stop working immediately.
      </ConfirmDialog>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────

export function ProfileSettings() {
  const toast = useToast();
  const { me, refresh } = useMe();
  const [name, setName] = useState(me.user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card title="Your profile" description="How you appear to teammates and, by first name, to contacts you reply to.">
        <div className="max-w-lg space-y-4 p-5">
          <Field label="Name">
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" value={me.user.email} disabled />
          </Field>
          <Button
            loading={busy === "name"}
            disabled={!name.trim() || name === me.user.name}
            onClick={async () => {
              setBusy("name");
              try {
                await api("/api/me", { method: "PATCH", body: { name: name.trim() } });
                refresh();
                toast("Profile updated");
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      <Card title="Password" description="Changing your password signs you out on your other devices.">
        <div className="max-w-lg space-y-4 p-5">
          <Field label="Current password">
            <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Button
            loading={busy === "password"}
            disabled={!current || next.length < 8}
            onClick={async () => {
              setBusy("password");
              try {
                await api("/api/me/password", { body: { current, next } });
                setCurrent("");
                setNext("");
                toast("Password changed");
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Change password
          </Button>
        </div>
      </Card>
    </div>
  );
}
