"use client";

import { ExternalLink, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { WidgetMessage } from "@/lib/widget-server";
import type { WidgetConfig } from "@/lib/workspace";

interface Session {
  visitorId: string;
  token: string;
  config: WidgetConfig;
  brand: string;
  messages: WidgetMessage[];
}

type Msg = Omit<WidgetMessage, "at"> & { at: string | Date; pending?: boolean };

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

/** Plain text with clickable links. Everything is rendered as text nodes – never as HTML. */
function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={match[0]} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
        {match[0]}
      </a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function readableOn(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return "#fff";
  const n = Number.parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#16132d" : "#fff";
}

export function WidgetChat({
  channelId,
  preview,
  embedded,
}: {
  channelId: string;
  preview?: { visitorId: string; token: string };
  embedded: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const auth = useRef<string>("");
  const ready = useRef(false);
  const storageKey = `chat_widget_${channelId}`;

  const merge = useCallback((incoming: WidgetMessage[], announce: boolean) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return prev;
      if (announce && window.parent !== window) {
        for (const m of fresh) {
          if (m.from !== "visitor") window.parent.postMessage({ source: "chat-widget", type: "message" }, "*");
        }
      }
      return [...prev.filter((m) => !m.pending), ...fresh].sort((a, b) => +new Date(a.at) - +new Date(b.at));
    });
  }, []);

  // Open or resume the visitor session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: { visitorId?: string; token?: string } = {};
      if (preview) stored = preview;
      else {
        try {
          stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
        } catch {
          stored = {};
        }
      }
      try {
        const res = await fetch(`/api/widget/${channelId}/session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visitorId: stored.visitorId, token: stored.token }),
        });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as Session;
        if (cancelled) return;
        auth.current = `Visitor ${data.visitorId}.${data.token}`;
        if (!preview) {
          try {
            localStorage.setItem(storageKey, JSON.stringify({ visitorId: data.visitorId, token: data.token }));
          } catch {
            /* storage blocked – the session simply won't persist */
          }
        }
        setSession(data);
        setMessages(data.messages);
        ready.current = true;
      } catch {
        if (!cancelled) setFailed("Chat is unavailable right now. Please try again later.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId, preview, storageKey]);

  // Poll for replies from the bot or an agent.
  const lastAt = messages.filter((m) => !m.pending).at(-1)?.at;
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      // Re-request the last known message (minus 1ms) so nothing sharing its timestamp is skipped.
      const after = lastAt ? new Date(+new Date(lastAt) - 1).toISOString() : "";
      try {
        const res = await fetch(`/api/widget/${channelId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`, {
          headers: { authorization: auth.current },
        });
        if (res.ok) merge(((await res.json()) as { messages: WidgetMessage[] }).messages, true);
      } catch {
        /* offline – try again on the next tick */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [session, channelId, lastAt, merge]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: ready.current ? "smooth" : "auto" });
  }, [messages.length]);

  async function send(body: { text?: string; postback?: { payload: string; label: string } }, shown: string) {
    if (!session || sending) return;
    setSending(true);
    setFailed(null);
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, from: "visitor", agentName: null, kind: "text", text: shown, imageUrl: null, buttons: [], quickReplies: [], at: new Date(), pending: true },
    ]);
    try {
      const after = lastAt ? new Date(+new Date(lastAt) - 1).toISOString() : undefined;
      const res = await fetch(`/api/widget/${channelId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: auth.current },
        body: JSON.stringify({ ...body, after }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Message not sent");
      }
      merge(((await res.json()) as { messages: WidgetMessage[] }).messages, false);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setFailed(err instanceof Error ? err.message : "Message not sent");
      if (body.text) setDraft(body.text);
    } finally {
      setSending(false);
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send({ text }, text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  if (failed && !session) {
    return <div className="flex h-dvh items-center justify-center p-8 text-center text-sm text-slate-500">{failed}</div>;
  }
  if (!session) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" aria-label="Loading chat" />
      </div>
    );
  }

  const { config } = session;
  const onColor = readableOn(config.color);
  const last = messages.at(-1);
  const quickReplies = last && last.from !== "visitor" ? last.quickReplies : [];

  return (
    <div className="flex h-dvh flex-col bg-white text-[14.5px] text-ink">
      <header className="flex shrink-0 items-center gap-3 px-4 py-3.5" style={{ background: config.color, color: onColor }}>
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">{config.title}</div>
          <div className="text-xs leading-tight opacity-80">{preview ? "Preview — only you can see this" : "We usually reply in a few minutes"}</div>
        </div>
        {embedded && (
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => window.parent.postMessage({ source: "chat-widget", type: "close" }, "*")}
            className="rounded-lg p-1.5 opacity-80 transition hover:bg-white/15 hover:opacity-100"
          >
            <X className="size-5" />
          </button>
        )}
      </header>

      <div ref={scroller} className="scroll-thin flex-1 space-y-2 overflow-y-auto px-3.5 py-4" aria-live="polite">
        {config.greeting && messages.length === 0 && <Bubble side="left">{config.greeting}</Bubble>}

        {messages.map((m, i) => {
          const mine = m.from === "visitor";
          const prev = messages[i - 1];
          const showAgent = m.from === "agent" && m.agentName && (prev?.from !== "agent" || prev.agentName !== m.agentName);
          return (
            <div key={m.id} className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}>
              {showAgent && <span className="mb-1 ml-1 text-[11px] font-medium text-slate-500">{m.agentName}</span>}
              {m.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imageUrl} alt="" referrerPolicy="no-referrer" className="mb-1 max-h-64 max-w-[82%] rounded-2xl object-cover" />
              )}
              {(m.text || m.kind !== "image") && m.text && (
                <Bubble side={mine ? "right" : "left"} color={mine ? config.color : undefined} textColor={mine ? onColor : undefined} faded={m.pending}>
                  <RichText text={m.text} />
                </Bubble>
              )}
              {m.buttons.length > 0 && (
                <div className="mt-1.5 flex w-full max-w-[82%] flex-col gap-1.5">
                  {m.buttons.map((b, bi) =>
                    b.url ? (
                      <a
                        key={bi}
                        href={/^https?:\/\//i.test(b.url) ? b.url : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-sm font-medium transition hover:bg-slate-50"
                        style={{ borderColor: config.color, color: config.color }}
                      >
                        {b.label} <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <button
                        key={bi}
                        type="button"
                        disabled={sending}
                        onClick={() => send({ postback: { payload: b.payload ?? "", label: b.label } }, b.label)}
                        className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: config.color, color: config.color }}
                      >
                        {b.label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {quickReplies.length > 0 && (
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5 px-3.5 pb-2">
          {quickReplies.map((q) => (
            <button
              key={q.payload}
              type="button"
              disabled={sending}
              onClick={() => send({ postback: { payload: q.payload, label: q.label } }, q.label)}
              className="rounded-full border bg-white px-3.5 py-1.5 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: config.color, color: config.color }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {failed && <div className="shrink-0 px-4 pb-1 text-xs text-rose-600" role="alert">{failed}</div>}

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-slate-100 px-3 py-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder={config.placeholder}
          aria-label="Message"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl bg-slate-100 px-3.5 py-2.5 text-[14.5px] leading-snug outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-slate-200"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim() || sending}
          className="flex size-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
          style={{ background: config.color, color: onColor }}
        >
          <SendHorizontal className="size-[18px]" />
        </button>
      </form>
      <div className="shrink-0 pb-2 text-center text-[11px] text-slate-400">Powered by {session.brand}</div>
    </div>
  );
}

function Bubble({
  side,
  color,
  textColor,
  faded,
  children,
}: {
  side: "left" | "right";
  color?: string;
  textColor?: string;
  faded?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 leading-snug ${
        side === "right" ? "rounded-br-md" : "rounded-bl-md bg-slate-100 text-ink"
      } ${faded ? "opacity-60" : ""}`}
      style={color ? { background: color, color: textColor } : undefined}
    >
      {children}
    </div>
  );
}
