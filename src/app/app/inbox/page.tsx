"use client";

import clsx from "clsx";
import { ArrowLeft, Bot, BotOff, Check, CircleAlert, ExternalLink, Inbox, PanelRight, RotateCcw, Search, SendHorizontal, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import useSWR from "swr";
import { ContactDetails } from "@/components/app/contact-details";
import { useMe } from "@/components/app/shell";
import { ChannelIcon, channelLabel } from "@/components/brand";
import { Avatar, Button, EmptyState, IconButton, Menu, MenuItem, Spinner, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { formatTime, timeAgo } from "@/lib/format";
import type { ConversationDTO, MessageDTO } from "@/lib/serializers";

interface ListResponse {
  conversations: ConversationDTO[];
  hasMore: boolean;
  counts: { open: number; mine: number };
}

type StatusFilter = "OPEN" | "CLOSED" | "ALL";
type AssigneeFilter = "all" | "me" | "unassigned";

export default function InboxPage() {
  return (
    <Suspense>
      <InboxScreen />
    </Suspense>
  );
}

function InboxScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("c");
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const key = `/api/conversations?status=${status}&assignee=${assignee}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const list = useSWR<ListResponse>(key, { refreshInterval: 5000, keepPreviousData: true });
  const select = (id: string | null) => router.replace(id ? `/app/inbox?c=${id}` : "/app/inbox");

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] bg-white lg:h-dvh">
      {/* Conversation list */}
      <section
        className={clsx("w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-[330px]", selectedId ? "hidden" : "flex")}
        aria-label="Conversations"
      >
        <div className="space-y-3 border-b border-slate-100 px-4 pb-3 pt-4">
          <h1 className="text-lg font-bold text-ink">Live Chat</h1>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-medium" role="group" aria-label="Status">
            {(
              [
                ["OPEN", `Open${list.data ? ` (${list.data.counts.open})` : ""}`],
                ["CLOSED", "Closed"],
                ["ALL", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={clsx("flex-1 rounded-md px-2 py-1.5 transition-colors", status === value ? "bg-white text-ink shadow-xs" : "text-slate-500 hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8" placeholder="Search people" aria-label="Search conversations" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input w-auto" aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value as AssigneeFilter)}>
              <option value="all">Everyone</option>
              <option value="me">Mine</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {!list.data ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : list.data.conversations.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title={status === "OPEN" ? "You're all caught up" : "No conversations"}>
              {status === "OPEN"
                ? "Chats appear here when the bot can't answer or a contact asks for a human."
                : "Nothing matches these filters yet."}
            </EmptyState>
          ) : (
            <ul>
              {list.data.conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c.id)}
                    aria-current={c.id === selectedId}
                    className={clsx(
                      "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors",
                      c.id === selectedId ? "bg-brand-50" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar name={c.contact.name} src={c.contact.avatarUrl} size={40} />
                      <ChannelIcon type={c.channel.type} size={16} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={clsx("truncate text-sm text-ink", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>{c.contact.name}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.lastMessageAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={clsx("truncate text-[13px]", c.unreadCount > 0 ? "text-slate-700" : "text-slate-500")}>{c.lastPreview || "No messages yet"}</span>
                        {c.unreadCount > 0 && (
                          <span className="tabular shrink-0 rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold leading-[18px] text-white">{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Thread */}
      {selectedId ? (
        <Thread
          key={selectedId}
          conversationId={selectedId}
          onBack={() => select(null)}
          onChanged={() => void list.mutate()}
          showDetails={showDetails}
          toggleDetails={() => setShowDetails((s) => !s)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-canvas md:flex">
          <EmptyState icon={<Inbox className="size-5" />} title="Select a conversation">
            Pick a chat on the left to read it and reply as your team.
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function Thread({
  conversationId,
  onBack,
  onChanged,
  showDetails,
  toggleDetails,
}: {
  conversationId: string;
  onBack: () => void;
  onChanged: () => void;
  showDetails: boolean;
  toggleDetails: () => void;
}) {
  const { me, refresh: refreshMe } = useMe();
  const toast = useToast();
  const convo = useSWR<{ conversation: ConversationDTO }>(`/api/conversations/${conversationId}`, { refreshInterval: 8000 });
  const messages = useSWR<{ messages: MessageDTO[]; hasMore: boolean }>(`/api/conversations/${conversationId}/messages`, { refreshInterval: 3000 });
  const members = useSWR<{ members: { userId: string; name: string }[] }>("/api/members");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const count = messages.data?.messages.length ?? 0;
  const lastId = messages.data?.messages.at(-1)?.id;

  // Keep the newest message in view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lastId, count]);

  // Opening a chat marks it as read.
  const unread = convo.data?.conversation.unreadCount ?? 0;
  useEffect(() => {
    if (unread > 0) {
      void api(`/api/conversations/${conversationId}/read`, { method: "POST" }).then(() => {
        void convo.mutate();
        onChanged();
        refreshMe();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, conversationId]);

  if (convo.error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState title="Conversation not found" action={<Button variant="secondary" onClick={onBack}>Back to inbox</Button>}>
          It may have been deleted.
        </EmptyState>
      </div>
    );
  }
  if (!convo.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  const c = convo.data.conversation;

  async function update(body: Record<string, unknown>, done?: string) {
    try {
      const res = await api<{ conversation: ConversationDTO }>(`/api/conversations/${conversationId}`, { method: "PATCH", body });
      await convo.mutate(res, { revalidate: false });
      onChanged();
      refreshMe();
      if (done) toast(done);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api<{ message: MessageDTO }>(`/api/conversations/${conversationId}/messages`, { body: { text } });
      setDraft("");
      await messages.mutate((prev) => (prev ? { ...prev, messages: [...prev.messages, res.message] } : prev), { revalidate: true });
      void convo.mutate();
      onChanged();
      if (res.message.status === "FAILED") toast(res.message.error ?? "The message could not be delivered.", "error");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col bg-canvas" aria-label={`Conversation with ${c.contact.name}`}>
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <button type="button" aria-label="Back to conversations" onClick={onBack} className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
            <ArrowLeft className="size-5" />
          </button>
          <Avatar name={c.contact.name} src={c.contact.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{c.contact.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ChannelIcon type={c.channel.type} size={14} /> {channelLabel(c.channel.type)}
            </div>
          </div>

          <Menu
            width={210}
            trigger={(props) => (
              <button type="button" {...props} className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 sm:flex">
                <UserRound className="size-4 text-slate-400" />
                {c.assignee ? c.assignee.name.split(" ")[0] : "Unassigned"}
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={c.assignee ? <span className="block size-4" /> : <Check className="text-brand-600" />}
                  onClick={() => {
                    close();
                    void update({ assigneeId: null });
                  }}
                >
                  Unassigned
                </MenuItem>
                {(members.data?.members ?? []).map((m) => (
                  <MenuItem
                    key={m.userId}
                    icon={c.assignee?.id === m.userId ? <Check className="text-brand-600" /> : <span className="block size-4" />}
                    onClick={() => {
                      close();
                      void update({ assigneeId: m.userId });
                    }}
                  >
                    {m.name}
                    {m.userId === me.user.id ? " (you)" : ""}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>

          {c.status === "OPEN" ? (
            <Button variant="secondary" size="sm" icon={<Check className="size-4" />} onClick={() => update({ status: "CLOSED" }, "Conversation closed")}>
              Close
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => update({ status: "OPEN" })}>
              Reopen
            </Button>
          )}
          <IconButton label={showDetails ? "Hide contact details" : "Show contact details"} onClick={toggleDetails} className="hidden xl:inline-flex">
            <PanelRight className="size-4.5" />
          </IconButton>
        </header>

        {c.botPaused && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
            <BotOff className="size-4 shrink-0" />
            <span className="flex-1">The bot is paused in this chat so it doesn&apos;t talk over your team.</span>
            <button type="button" onClick={() => update({ botPaused: false }, "Bot resumed")} className="font-semibold underline-offset-2 hover:underline">
              Resume bot
            </button>
          </div>
        )}

        <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
          {!messages.data ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            messages.data.messages.map((m, i) => <MessageBubble key={m.id} message={m} previous={messages.data!.messages[i - 1]} />)
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 shadow-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/15">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={`Reply to ${c.contact.name.split(" ")[0]}…`}
              aria-label="Reply"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-slate-400"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <Button size="sm" loading={sending} disabled={!draft.trim()} onClick={send} icon={<SendHorizontal className="size-4" />}>
              Send
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span>Enter to send · Shift + Enter for a new line</span>
            {!c.botPaused && (
              <button type="button" onClick={() => update({ botPaused: true }, "Bot paused for this chat")} className="flex items-center gap-1 font-medium text-slate-500 hover:text-ink">
                <Bot className="size-3.5" /> Pause bot
              </button>
            )}
          </div>
        </div>
      </section>

      {showDetails && (
        <aside className="scroll-thin hidden w-[300px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white xl:block" aria-label="Contact details">
          <ContactDetails contactId={c.contact.id} onChanged={() => void convo.mutate()} />
        </aside>
      )}
    </>
  );
}

function MessageBubble({ message: m, previous }: { message: MessageDTO; previous?: MessageDTO }) {
  const inbound = m.direction === "IN";
  const newGroup = !previous || previous.direction !== m.direction || previous.senderType !== m.senderType || +new Date(m.createdAt) - +new Date(previous.createdAt) > 5 * 60_000;
  const who = inbound ? null : m.senderType === "AGENT" ? (m.senderName ?? "Agent") : "Bot";

  return (
    <div className={clsx("flex flex-col", inbound ? "items-start" : "items-end", newGroup && "pt-2.5")}>
      {newGroup && (
        <span className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
          {who && (
            <span className="flex items-center gap-1 font-medium text-slate-500">
              {m.senderType === "BOT" && <Bot className="size-3" />}
              {who}
            </span>
          )}
          {formatTime(m.createdAt)}
        </span>
      )}
      {m.payload?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.payload.imageUrl} alt="" referrerPolicy="no-referrer" className="mb-1 max-h-60 max-w-[min(70%,420px)] rounded-2xl object-cover" />
      )}
      {m.text && (
        <div
          className={clsx(
            "max-w-[min(70%,520px)] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            inbound
              ? "rounded-bl-md bg-white text-ink shadow-card ring-1 ring-slate-200/70"
              : m.senderType === "AGENT"
                ? "rounded-br-md bg-brand-600 text-white"
                : "rounded-br-md bg-brand-100 text-brand-950",
            m.kind === "postback" && "italic",
          )}
        >
          {m.text}
        </div>
      )}
      {(m.payload?.buttons?.length || m.payload?.quickReplies?.length) && (
        <div className="mt-1 flex max-w-[min(70%,520px)] flex-wrap justify-end gap-1">
          {[...(m.payload.buttons ?? []), ...(m.payload.quickReplies ?? [])].map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2 py-0.5 text-xs font-medium text-brand-700">
              {b.label}
              {"url" in b && b.url && <ExternalLink className="size-3" />}
            </span>
          ))}
        </div>
      )}
      {m.status === "FAILED" && (
        <span className="mt-1 flex items-center gap-1 px-1 text-[11px] font-medium text-rose-600">
          <CircleAlert className="size-3" /> Not delivered{m.error ? ` — ${m.error}` : ""}
        </span>
      )}
    </div>
  );
}
