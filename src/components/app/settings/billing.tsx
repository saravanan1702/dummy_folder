"use client";

import clsx from "clsx";
import { Check, CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/app/shell";
import { Badge, Button, useToast } from "@/components/ui";
import { PLAN_ORDER, PLANS, isUnlimited, type PlanId } from "@/config/plans";
import { api, errorMessage } from "@/lib/client";
import { formatDate, formatNumber } from "@/lib/format";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = isUnlimited(limit);
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(1, limit));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-slate-600">{label}</span>
        <span className="tabular font-medium text-ink">
          {formatNumber(used)} <span className="font-normal text-slate-400">/ {unlimited ? "Unlimited" : formatNumber(limit)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx("h-full rounded-full", ratio >= 1 ? "bg-rose-500" : ratio > 0.8 ? "bg-amber-500" : "bg-brand-500")} style={{ width: unlimited ? "0%" : `${Math.max(1.5, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function BillingSettings() {
  const toast = useToast();
  const params = useSearchParams();
  const { me } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const current = me.workspace.plan as PlanId;
  const isOwner = me.role === "OWNER";

  async function go(path: string, body: unknown, key: string) {
    setBusy(key);
    try {
      const res = await api<{ url: string }>(path, { method: "POST", body });
      window.location.href = res.url;
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {params.get("upgraded") && (
        <div className="flex items-center gap-2.5 rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <Check className="size-4.5" /> Thanks for upgrading! Your new plan is being activated — it can take a few seconds to show up here.
        </div>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">{PLANS[current].name} plan</h2>
              {me.workspace.subscriptionStatus === "past_due" && <Badge tone="red">Payment overdue</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {current === "FREE"
                ? "You're on the free plan."
                : me.workspace.currentPeriodEnd
                  ? `Renews on ${formatDate(me.workspace.currentPeriodEnd)}.`
                  : "Your subscription is active."}
            </p>
          </div>
          {current !== "FREE" && isOwner && (
            <Button variant="secondary" icon={<CreditCard className="size-4" />} loading={busy === "portal"} onClick={() => go("/api/billing/portal", undefined, "portal")}>
              Manage billing
            </Button>
          )}
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Meter label="Contacts" used={me.usage.contacts} limit={me.limits.contacts} />
          <Meter label="Team seats" used={me.usage.seats} limit={me.limits.seats} />
          <Meter label="Messaging channels" used={me.usage.channels} limit={me.limits.channels} />
          <Meter label="Flows" used={me.usage.flows} limit={me.limits.flows} />
          <Meter label="Broadcasts this month" used={me.usage.broadcastsThisMonth} limit={me.limits.broadcastsPerMonth} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = id === current;
            const isUpgrade = PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current);
            return (
              <article key={id} className={clsx("card flex flex-col p-5", isCurrent && "border-brand-400 ring-3 ring-brand-500/10")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                  {isCurrent && <Badge tone="brand">Current plan</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[30px] font-bold leading-none text-ink">${plan.price}</span>
                  <span className="text-[13px] text-slate-500">/ month</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{plan.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-slate-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-mint-600" /> {f}
                    </li>
                  ))}
                </ul>
                {id !== "FREE" && !isCurrent && (
                  <Button
                    className="mt-5 w-full"
                    variant={isUpgrade ? "primary" : "secondary"}
                    disabled={!isOwner}
                    loading={busy === id}
                    onClick={() => go("/api/billing/checkout", { plan: id }, id)}
                  >
                    {isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
        {!isOwner && <p className="mt-3 text-[13px] text-slate-500">Only the workspace owner can change the plan.</p>}
      </section>
    </div>
  );
}
