import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { PLANS, type PlanId } from "@/config/plans";
import { db } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSuperadminPage } from "@/lib/superadmin";
import { PlanSelect } from "./plan-select";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card p-4.5">
      <div className="text-[13px] font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-[28px] font-semibold leading-none text-ink">{value}</div>
      {note && <div className="mt-2 text-xs text-slate-500">{note}</div>}
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSuperadminPage();
  const q = (await searchParams).q?.trim() ?? "";
  const since = daysAgo(30);

  const [users, newUsers, byPlan, contacts, messages30, workspaces] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.workspace.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.contact.count({ where: { isPreview: false } }),
    db.message.count({ where: { createdAt: { gte: since } } }),
    db.workspace.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { memberships: { some: { user: { email: { contains: q, mode: "insensitive" } } } } }] }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        memberships: { where: { role: "OWNER" }, include: { user: { select: { email: true, name: true } } } },
        _count: { select: { contacts: true, channels: true, memberships: true, flows: true } },
      },
    }),
  ]);

  const planCount = (p: PlanId) => byPlan.find((b) => b.plan === p)?._count._all ?? 0;
  const paidActive = await db.workspace.groupBy({
    by: ["plan"],
    where: { plan: { not: "FREE" }, subscriptionStatus: { in: ["active", "trialing", "past_due"] } },
    _count: { _all: true },
  });
  const mrr = paidActive.reduce((sum, b) => sum + PLANS[b.plan as PlanId].price * b._count._all, 0);
  const totalWs = byPlan.reduce((s, b) => s + b._count._all, 0);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-5">
          <Logo />
          <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          <Link href="/app" className="ml-auto text-sm font-medium text-slate-600 hover:text-ink">Back to app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] space-y-6 px-5 py-7">
        <h1 className="text-[22px] font-bold text-ink">Platform overview</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Monthly recurring revenue" value={`$${formatNumber(mrr)}`} note="Active Stripe subscriptions × list price" />
          <Stat label="Workspaces" value={formatNumber(totalWs)} note={`${planCount("PRO")} Pro · ${planCount("BUSINESS")} Business · ${planCount("FREE")} Free`} />
          <Stat label="Users" value={formatNumber(users)} note={`${formatNumber(newUsers)} joined in the last 30 days`} />
          <Stat label="Messages (30 days)" value={formatNumber(messages30)} note={`${formatNumber(contacts)} contacts in total`} />
        </div>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Customers</h2>
            <form className="flex gap-2">
              <input name="q" defaultValue={q} placeholder="Search workspace or owner email" aria-label="Search customers" className="input w-72" />
              <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50">Search</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Workspace</th>
                  <th scope="col" className="px-3 py-3 font-medium">Owner</th>
                  <th scope="col" className="px-3 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-3 py-3 font-medium">Billing</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Contacts</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Channels</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Seats</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspaces.map((w) => {
                  const owner = w.memberships[0]?.user;
                  return (
                    <tr key={w.id}>
                      <td className="px-5 py-3 font-medium text-ink">{w.name}</td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">{owner ? <>{owner.name}<br /><span className="text-slate-400">{owner.email}</span></> : "—"}</td>
                      <td className="px-3 py-3"><PlanSelect workspaceId={w.id} plan={w.plan} /></td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">{w.subscriptionStatus ?? "—"}</td>
                      <td className="tabular px-3 py-3 text-right">{formatNumber(w._count.contacts)}</td>
                      <td className="tabular px-3 py-3 text-right">{w._count.channels}</td>
                      <td className="tabular px-3 py-3 text-right">{w._count.memberships}</td>
                      <td className="whitespace-nowrap px-3 py-3 pr-5 text-[13px] text-slate-500">{formatDate(w.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
