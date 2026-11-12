"use client";

import { Check, Plus, Send, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ChannelIcon, channelLabel } from "@/components/brand";
import { Avatar, Badge, Button, Field, Menu, MenuItem, Modal, Spinner, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ContactDTO } from "@/lib/serializers";

type Contact = ContactDTO & { conversationId?: string | null };

interface TagRow {
  id: string;
  name: string;
}
interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: string;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13px]">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-ink">{children}</span>
    </div>
  );
}

/** Click-to-edit text value that saves on blur / Enter. */
function InlineEdit({
  value,
  placeholder,
  onSave,
  type = "text",
  label,
}: {
  value: string | null;
  placeholder: string;
  onSave: (next: string) => Promise<void>;
  type?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      aria-label={label}
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== (value ?? "")) void onSave(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
      className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[13px] text-ink outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:text-left"
    />
  );
}

export function ContactDetails({
  contactId,
  onChanged,
  footer,
}: {
  contactId: string;
  /** Called after any edit so parent lists can refresh. */
  onChanged?: () => void;
  footer?: (contact: Contact) => ReactNode;
}) {
  const toast = useToast();
  const { data, mutate } = useSWR<{ contact: Contact }>(`/api/contacts/${contactId}`);
  const tags = useSWR<{ tags: TagRow[] }>("/api/tags");
  const fields = useSWR<{ fields: FieldRow[] }>("/api/fields");
  const [newTag, setNewTag] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  const contact = data.contact;

  async function patch(body: Record<string, unknown>) {
    try {
      const res = await api<{ contact: Contact }>(`/api/contacts/${contactId}`, { method: "PATCH", body });
      await mutate({ contact: { ...res.contact, conversationId: contact.conversationId } }, { revalidate: false });
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function addTag(tagId: string) {
    await patch({ tagIds: [...contact.tags.map((t) => t.id), tagId] });
  }

  async function createAndAddTag() {
    const name = newTag.trim();
    if (!name) return;
    try {
      const res = await api<{ tag: TagRow }>("/api/tags", { body: { name } });
      setNewTag("");
      void tags.mutate();
      await addTag(res.tag.id);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const available = (tags.data?.tags ?? []).filter((t) => !contact.tags.some((c) => c.id === t.id));

  return (
    <div>
      <div className="flex flex-col items-center px-5 pb-4 pt-6 text-center">
        <Avatar name={contact.name} src={contact.avatarUrl} size={64} />
        <h3 className="mt-3 text-base font-semibold text-ink">{contact.name}</h3>
        <div className="mt-1.5 flex items-center gap-2 text-[13px] text-slate-500">
          <ChannelIcon type={contact.channelType} size={18} />
          {channelLabel(contact.channelType)}
          {contact.username && <span>· @{contact.username}</span>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={contact.status === "SUBSCRIBED" ? "green" : "neutral"}>{contact.status === "SUBSCRIBED" ? "Subscribed" : "Unsubscribed"}</Badge>
          <button
            type="button"
            onClick={() => patch({ status: contact.status === "SUBSCRIBED" ? "UNSUBSCRIBED" : "SUBSCRIBED" })}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            {contact.status === "SUBSCRIBED" ? "Unsubscribe" : "Resubscribe"}
          </button>
        </div>
        <Button variant="subtle" size="sm" className="mt-4" icon={<Send className="size-3.5" />} onClick={() => setFlowOpen(true)}>
          Send a flow
        </Button>
      </div>

      <section className="border-t border-slate-100 px-5 py-4">
        <h4 className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">Details</h4>
        <Row label="First name">
          <InlineEdit label="First name" value={contact.firstName} placeholder="Add" onSave={(v) => patch({ firstName: v || null })} />
        </Row>
        <Row label="Last name">
          <InlineEdit label="Last name" value={contact.lastName} placeholder="Add" onSave={(v) => patch({ lastName: v || null })} />
        </Row>
        <Row label="Email">
          <InlineEdit label="Email" type="email" value={contact.email} placeholder="Add" onSave={(v) => patch({ email: v || null })} />
        </Row>
        <Row label="Phone">
          <InlineEdit label="Phone" type="tel" value={contact.phone} placeholder="Add" onSave={(v) => patch({ phone: v || null })} />
        </Row>
        <Row label="Subscribed">{formatDate(contact.createdAt)}</Row>
        <Row label="Last message">{contact.lastInboundAt ? formatDateTime(contact.lastInboundAt) : "—"}</Row>
      </section>

      <section className="border-t border-slate-100 px-5 py-4">
        <h4 className="mb-2.5 font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          {contact.tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-700">
              {t.name}
              <button
                type="button"
                aria-label={`Remove tag ${t.name}`}
                onClick={() => patch({ tagIds: contact.tags.filter((x) => x.id !== t.id).map((x) => x.id) })}
                className="rounded p-0.5 hover:bg-brand-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Menu
            align="left"
            width={220}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                <Plus className="size-3" /> Add tag
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="flex gap-1.5 p-1.5">
                  <input
                    className="input py-1.5"
                    autoFocus
                    value={newTag}
                    maxLength={50}
                    placeholder="New tag…"
                    aria-label="New tag name"
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void createAndAddTag().then(close);
                      }
                    }}
                  />
                  <Button size="sm" className="h-auto px-2" disabled={!newTag.trim()} onClick={() => void createAndAddTag().then(close)} aria-label="Create tag">
                    <Check className="size-4" />
                  </Button>
                </div>
                <div className="scroll-thin max-h-48 overflow-y-auto">
                  {available.map((t) => (
                    <MenuItem
                      key={t.id}
                      onClick={() => {
                        close();
                        void addTag(t.id);
                      }}
                    >
                      {t.name}
                    </MenuItem>
                  ))}
                  {available.length === 0 && <p className="px-2.5 py-2 text-xs text-slate-400">Type a name to create a tag.</p>}
                </div>
              </div>
            )}
          </Menu>
        </div>
      </section>

      {(fields.data?.fields.length ?? 0) > 0 && (
        <section className="border-t border-slate-100 px-5 py-4">
          <h4 className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-slate-500">Custom fields</h4>
          {fields.data!.fields.map((f) => (
            <Row key={f.id} label={f.label}>
              <InlineEdit label={f.label} value={contact.fields[f.key] ?? null} placeholder="—" onSave={(v) => patch({ fields: { [f.key]: v } })} />
            </Row>
          ))}
        </section>
      )}

      {footer && <div className="border-t border-slate-100 px-5 py-4">{footer(contact)}</div>}

      <SendFlowModal open={flowOpen} onClose={() => setFlowOpen(false)} contactId={contactId} contactName={contact.name} onSent={onChanged} />
    </div>
  );
}

export function SendFlowModal({
  open,
  onClose,
  contactId,
  contactName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  onSent?: () => void;
}) {
  const toast = useToast();
  const flows = useSWR<{ flows: { id: string; name: string; status: string }[] }>(open ? "/api/flows" : null);
  const [flowId, setFlowId] = useState("");
  const [busy, setBusy] = useState(false);
  const live = (flows.data?.flows ?? []).filter((f) => f.status === "PUBLISHED");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a flow"
      description={`Start a published flow for ${contactName} right now.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!flowId}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/contacts/${contactId}/start-flow`, { body: { flowId } });
                toast("Flow sent");
                onSent?.();
                onClose();
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Send flow
          </Button>
        </>
      }
    >
      <Field label="Flow" hint={flows.data && live.length === 0 ? "You have no published flows yet." : undefined}>
        <select className="input" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
          <option value="">Choose a flow…</option>
          {live.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}
