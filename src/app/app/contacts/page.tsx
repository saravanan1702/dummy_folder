"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download, MessageCircle, Search, Tag, Trash2, UserMinus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ContactDetails } from "@/components/app/contact-details";
import { Page } from "@/components/app/shell";
import { ChannelIcon, channelLabel } from "@/components/brand";
import { Avatar, Badge, Button, ConfirmDialog, Drawer, EmptyState, Menu, MenuItem, PageHeader, PageLoader, buttonClass, useToast } from "@/components/ui";
import type { ChannelDTO } from "@/lib/channel-view";
import { api, errorMessage } from "@/lib/client";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import type { ContactDTO } from "@/lib/serializers";

interface ListResponse {
  total: number;
  page: number;
  size: number;
  contacts: ContactDTO[];
}

export default function ContactsPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const qs = new URLSearchParams();
  if (search) qs.set("q", search);
  if (channel) qs.set("channel", channel);
  if (tag) qs.set("tag", tag);
  if (status) qs.set("status", status);
  const filterQuery = qs.toString();
  qs.set("page", String(page));

  const list = useSWR<ListResponse>(`/api/contacts?${qs.toString()}`, { keepPreviousData: true });
  const tags = useSWR<{ tags: { id: string; name: string }[] }>("/api/tags");
  const channels = useSWR<{ channels: ChannelDTO[] }>("/api/channels");

  const rows = list.data?.contacts ?? [];
  const total = list.data?.total ?? 0;
  const size = list.data?.size ?? 25;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const filtered = !!(search || channel || tag || status);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: string, tagId?: string) {
    try {
      const res = await api<{ affected: number }>("/api/contacts/bulk", { body: { ids: [...selected], action, tagId } });
      toast(`Updated ${res.affected} contact${res.affected === 1 ? "" : "s"}`);
      setSelected(new Set());
      void list.mutate();
      void tags.mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <Page>
      <PageHeader
        title="Contacts"
        description={list.data ? `${formatNumber(total)} ${filtered ? "matching " : ""}contact${total === 1 ? "" : "s"}` : "Everyone who has messaged you"}
        actions={
          <a href={`/api/contacts/export${filterQuery ? `?${filterQuery}` : ""}`} className={buttonClass("secondary")} download>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, email or phone" aria-label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Channel" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}>
          <option value="">All channels</option>
          {(channels.data?.channels ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Tag" value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}>
          <option value="">All tags</option>
          {(tags.data?.tags ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <span className="mr-2 text-sm font-semibold text-brand-800">{selected.size} selected</span>
            <Menu
              align="left"
              trigger={(props) => (
                <Button variant="secondary" size="sm" icon={<Tag className="size-3.5" />} {...props}>
                  Add tag
                </Button>
              )}
            >
              {(close) => (
                <div className="scroll-thin max-h-56 overflow-y-auto">
                  {(tags.data?.tags ?? []).map((t) => (
                    <MenuItem key={t.id} onClick={() => { close(); void bulk("add_tag", t.id); }}>
                      {t.name}
                    </MenuItem>
                  ))}
                  {(tags.data?.tags.length ?? 0) === 0 && <p className="px-2.5 py-2 text-xs text-slate-500">Create tags in Settings → Tags.</p>}
                </div>
              )}
            </Menu>
            <Menu
              align="left"
              trigger={(props) => (
                <Button variant="secondary" size="sm" {...props}>
                  Remove tag
                </Button>
              )}
            >
              {(close) => (
                <div className="scroll-thin max-h-56 overflow-y-auto">
                  {(tags.data?.tags ?? []).map((t) => (
                    <MenuItem key={t.id} onClick={() => { close(); void bulk("remove_tag", t.id); }}>
                      {t.name}
                    </MenuItem>
                  ))}
                </div>
              )}
            </Menu>
            <Button variant="secondary" size="sm" icon={<UserMinus className="size-3.5" />} onClick={() => bulk("unsubscribe")}>
              Unsubscribe
            </Button>
            <Button variant="secondary" size="sm" icon={<Trash2 className="size-3.5" />} className="text-rose-600" onClick={() => setConfirmDelete([...selected])}>
              Delete
            </Button>
            <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-1.5 text-brand-700 hover:bg-brand-100">
              <X className="size-4" />
            </button>
          </div>
        )}

        {!list.data ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title={filtered ? "No contacts match" : "No contacts yet"}>
            {filtered
              ? "Try a different search or clear the filters."
              : "People become contacts the moment they message you. Share your chat link or connect a channel to get started."}
          </EmptyState>
        ) : (
          <div className={clsx("overflow-x-auto transition-opacity", list.isValidating && list.data.page !== page && "opacity-60")}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="w-10 py-3 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="size-4 rounded border-slate-300 accent-brand-600"
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const r of rows) {
                            if (allOnPage) next.delete(r.id);
                            else next.add(r.id);
                          }
                          return next;
                        })
                      }
                    />
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">Contact</th>
                  <th scope="col" className="px-3 py-3 font-medium">Channel</th>
                  <th scope="col" className="px-3 py-3 font-medium">Tags</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Subscribed</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Last message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className={clsx("cursor-pointer transition-colors", selected.has(c.id) ? "bg-brand-50/60" : "hover:bg-slate-50/70")} onClick={() => setOpenId(c.id)}>
                    <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        className="size-4 rounded border-slate-300 accent-brand-600"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={(e) => { e.stopPropagation(); setOpenId(c.id); }}>
                        <Avatar name={c.name} src={c.avatarUrl} size={34} />
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate font-medium text-ink">{c.name}</span>
                          <span className="block max-w-[220px] truncate text-xs text-slate-500">{c.email ?? c.phone ?? (c.username ? `@${c.username}` : "")}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 whitespace-nowrap text-[13px] text-slate-600">
                        <ChannelIcon type={c.channelType} size={20} /> {channelLabel(c.channelType)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex max-w-[240px] flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t.id} tone="brand">
                            {t.name}
                          </Badge>
                        ))}
                        {c.tags.length > 3 && <Badge>+{c.tags.length - 3}</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3">{c.status === "SUBSCRIBED" ? <Badge tone="green">Subscribed</Badge> : <Badge>Unsubscribed</Badge>}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 pr-5 text-[13px] text-slate-500">{c.lastInboundAt ? timeAgo(c.lastInboundAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > size && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[13px] text-slate-500">
            <span className="tabular">
              {(page - 1) * size + 1}–{Math.min(page * size, total)} of {formatNumber(total)}
            </span>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page * size >= total} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={!!openId} onClose={() => setOpenId(null)} title="Contact">
        {openId && (
          <ContactDetails
            contactId={openId}
            onChanged={() => void list.mutate()}
            footer={(contact) => (
              <div className="flex items-center justify-between gap-2">
                {contact.conversationId ? (
                  <Link href={`/app/inbox?c=${contact.conversationId}`} className={buttonClass("secondary", "sm")}>
                    <MessageCircle className="size-4" /> Open conversation
                  </Link>
                ) : (
                  <span />
                )}
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete([contact.id])}>
                  Delete
                </Button>
              </div>
            )}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length === 1 ? "this contact" : `${confirmDelete?.length} contacts`}?`}
        onConfirm={async () => {
          try {
            await api("/api/contacts/bulk", { body: { ids: confirmDelete, action: "delete" } });
            setSelected(new Set());
            setOpenId(null);
            void list.mutate();
            toast("Deleted");
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        Their conversation history, tags and field values will be permanently removed. This can&apos;t be undone.
      </ConfirmDialog>
    </Page>
  );
}
