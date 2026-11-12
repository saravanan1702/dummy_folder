"use client";

import clsx from "clsx";
import { ArrowRight, Check, Inbox, MessageCircle, Send, Users, Workflow, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { Page, useMe } from "@/components/app/shell";
import { ChannelIcon, channelLabel } from "@/components/brand";
import { BarList, ChartCard, Legend, SERIES, StatTile, TimeSeriesChart } from "@/components/charts";
import { EmptyState, PageLoader } from "@/components/ui";
import type { ChannelDTO } from "@/lib/channel-view";
import { percentChange } from "@/lib/format";

interface Stats {
  days: number;
  totals: {
    contacts: number;
    newContacts: number;
    prevNewContacts: number;
    messagesOut: number;
    prevMessagesOut: number;
    messagesIn: number;
    openConversations: number;
    flowRuns: number;
    prevFlowRuns: number;
  };
  contactSeries: { date: string; value: number }[];
  messageSeries: { date: string; received: number; sent: number }[];
  channels: { type: string; contacts: number }[];
  topFlows: { id: string; name: string; runs: number }[];
}

const RANGES = [7, 30, 90] as const;

export default function DashboardPage() {
  const { me } = useMe();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, isLoading } = useSWR<Stats>(`/api/stats?days=${days}`, { keepPreviousData: true, refreshInterval: 60_000 });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const vs = `vs previous ${days} days`;

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-ink">
            {greeting}, {me.user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s how {me.workspace.name} is doing.</p>
        </div>
      </div>

      <GettingStarted />

      {/* One filter row scoping everything below it */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[13px] font-medium shadow-xs" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              className={clsx("rounded-md px-3 py-1.5 transition-colors", days === r ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <PageLoader />
      ) : (
        <div className={clsx("space-y-4 transition-opacity", isLoading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Total contacts"
              value={data.totals.contacts}
              delta={percentChange(data.totals.newContacts, data.totals.prevNewContacts)}
              deltaLabel={percentChange(data.totals.newContacts, data.totals.prevNewContacts) === null ? `${data.totals.newContacts} new` : `new, ${vs}`}
              icon={<Users />}
            />
            <StatTile
              label="Messages sent"
              value={data.totals.messagesOut}
              delta={percentChange(data.totals.messagesOut, data.totals.prevMessagesOut)}
              deltaLabel={percentChange(data.totals.messagesOut, data.totals.prevMessagesOut) === null ? "no earlier data" : vs}
              icon={<Send />}
            />
            <StatTile
              label="Flow runs"
              value={data.totals.flowRuns}
              delta={percentChange(data.totals.flowRuns, data.totals.prevFlowRuns)}
              deltaLabel={percentChange(data.totals.flowRuns, data.totals.prevFlowRuns) === null ? "no earlier data" : vs}
              icon={<Workflow />}
            />
            <StatTile label="Open conversations" value={data.totals.openConversations} deltaLabel="waiting for your team" icon={<Inbox />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="New contacts"
              subtitle={`${data.totals.newContacts.toLocaleString("en-US")} in the last ${days} days`}
              table={{ columns: ["Date", "New contacts"], rows: data.contactSeries.map((d) => [d.date, d.value]) }}
            >
              <TimeSeriesChart
                ariaLabel={`New contacts per day over the last ${days} days`}
                dates={data.contactSeries.map((d) => d.date)}
                series={[{ name: "New contacts", color: SERIES.primary, values: data.contactSeries.map((d) => d.value) }]}
              />
            </ChartCard>

            <ChartCard
              title="Messages"
              subtitle={`${data.totals.messagesOut.toLocaleString("en-US")} sent · ${data.totals.messagesIn.toLocaleString("en-US")} received`}
              legend={
                <Legend
                  items={[
                    { name: "Sent", color: SERIES.primary },
                    { name: "Received", color: SERIES.secondary },
                  ]}
                />
              }
              table={{ columns: ["Date", "Sent", "Received"], rows: data.messageSeries.map((d) => [d.date, d.sent, d.received]) }}
            >
              <TimeSeriesChart
                ariaLabel={`Messages sent and received per day over the last ${days} days`}
                dates={data.messageSeries.map((d) => d.date)}
                series={[
                  { name: "Sent", color: SERIES.primary, values: data.messageSeries.map((d) => d.sent) },
                  { name: "Received", color: SERIES.secondary, values: data.messageSeries.map((d) => d.received) },
                ]}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Contacts by channel"
              subtitle="Where your audience talks to you"
              table={{ columns: ["Channel", "Contacts"], rows: data.channels.map((c) => [channelLabel(c.type), c.contacts]) }}
            >
              {data.totals.contacts === 0 ? (
                <EmptyState icon={<Users className="size-5" />} title="No contacts yet">
                  Contacts appear here as soon as people message you on any connected channel.
                </EmptyState>
              ) : (
                <BarList
                  unit="contacts"
                  items={data.channels.map((c) => ({
                    key: c.type,
                    name: channelLabel(c.type),
                    value: c.contacts,
                    label: (
                      <>
                        <ChannelIcon type={c.type} size={20} />
                        {channelLabel(c.type)}
                      </>
                    ),
                  }))}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Top flows"
              subtitle={`Most triggered in the last ${days} days`}
              table={{ columns: ["Flow", "Runs"], rows: data.topFlows.map((f) => [f.name, f.runs]) }}
            >
              {data.topFlows.length === 0 ? (
                <EmptyState icon={<Workflow className="size-5" />} title="No flow activity yet">
                  Once contacts start triggering your flows, the busiest ones show up here.
                </EmptyState>
              ) : (
                <BarList
                  unit="runs"
                  items={data.topFlows.map((f) => ({
                    key: f.id,
                    name: f.name,
                    value: f.runs,
                    label: (
                      <Link href={`/app/automation/flows/${f.id}`} className="truncate hover:text-brand-700 hover:underline">
                        {f.name}
                      </Link>
                    ),
                  }))}
                />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </Page>
  );
}

function GettingStarted() {
  const { me } = useMe();
  const { data } = useSWR<{ channels: ChannelDTO[] }>("/api/channels");
  const storageKey = `cv_onboarding_${me.workspace.id}`;
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [hidden, setDismissed] = useState(false);
  const dismissed = stored || hidden;

  const webchat = data?.channels.find((c) => c.type === "WEBCHAT");
  const steps = [
    {
      done: me.usage.contacts > 0,
      title: "Chat with your bot",
      body: "Open your website chat and say hi — a starter welcome flow is already live.",
      href: webchat ? `/widget/${webchat.id}` : "/app/growth",
      external: !!webchat,
      cta: "Open chat",
      icon: MessageCircle,
    },
    {
      done: me.usage.flows > 2,
      title: "Build your first flow",
      body: "Start from a template or a blank canvas and design your own conversation.",
      href: "/app/templates",
      cta: "Browse templates",
      icon: Workflow,
    },
    {
      done: me.usage.channels > 0,
      title: "Connect a messaging channel",
      body: "Add Telegram, WhatsApp, Messenger or Instagram to meet customers where they are.",
      href: "/app/settings?tab=channels",
      cta: "Connect channel",
      icon: Send,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  if (dismissed || completed === steps.length) return null;

  return (
    <section className="card relative mb-6 overflow-hidden p-5">
      <button
        type="button"
        aria-label="Dismiss getting started"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(storageKey, "1");
          } catch {
            /* storage unavailable */
          }
        }}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-ink">Get started</h2>
        <span className="tabular rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
          {completed} of {steps.length} done
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className={clsx("flex flex-col rounded-xl border p-4", s.done ? "border-mint-100 bg-mint-50/50" : "border-slate-200")}>
              <div className="flex items-center gap-2.5">
                <span className={clsx("flex size-8 items-center justify-center rounded-lg", s.done ? "bg-mint-500 text-white" : "bg-brand-50 text-brand-600")}>
                  {s.done ? <Check className="size-4.5" strokeWidth={3} /> : <Icon className="size-4.5" />}
                </span>
                <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">{s.title}</h3>
              </div>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-500">{s.body}</p>
              {!s.done && (
                <Link
                  href={s.href}
                  target={s.external ? "_blank" : undefined}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
                >
                  {s.cta} <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
