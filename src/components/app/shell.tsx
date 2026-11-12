"use client";

import clsx from "clsx";
import {
  Check,
  ChevronsUpDown,
  House,
  LayoutTemplate,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  MessageCircle,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { LogoMark } from "@/components/brand";
import { Avatar, Button, Field, Menu, MenuItem, Modal, ToastProvider, useToast } from "@/components/ui";
import { brand } from "@/config/brand";
import { isUnlimited, planOf } from "@/config/plans";
import { api, errorMessage, fetcher } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import type { Me } from "@/lib/me";

const MeContext = createContext<{ me: Me; refresh: () => void } | null>(null);

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside the dashboard shell");
  return ctx;
}

export function useCanManage() {
  const { me } = useMe();
  return me.role === "OWNER" || me.role === "ADMIN";
}

const NAV = [
  { href: "/app", label: "Home", icon: House, exact: true },
  { href: "/app/contacts", label: "Contacts", icon: Users },
  { href: "/app/automation", label: "Automation", icon: Workflow },
  { href: "/app/inbox", label: "Live Chat", icon: MessageCircle, badge: true },
  { href: "/app/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/app/growth", label: "Growth Tools", icon: Rocket },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ initialMe, children }: { initialMe: Me; children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>
      <ToastProvider>
        <ShellInner initialMe={initialMe}>{children}</ShellInner>
      </ToastProvider>
    </SWRConfig>
  );
}

function ShellInner({ initialMe, children }: { initialMe: Me; children: ReactNode }) {
  const { data, mutate } = useSWR<Me>("/api/me", { fallbackData: initialMe, refreshInterval: 20_000 });
  const me = data ?? initialMe;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MeContext.Provider value={{ me, refresh: () => void mutate() }}>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        {/* Mobile top bar */}
        <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)} className="-ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <MenuIcon className="size-5" />
          </button>
          <LogoMark size={26} />
          <span className="truncate text-sm font-semibold">{me.workspace.name}</span>
        </div>

        {mobileOpen && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}

        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:z-auto lg:translate-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <WorkspaceSwitcher />
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <X className="size-5" />
            </button>
          </div>

          <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
            {NAV.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              const badge = "badge" in item && item.badge ? me.openConversations : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
                  )}
                >
                  <Icon className={clsx("size-[18px]", active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="tabular rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-semibold leading-4 text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-slate-100 p-3">
            <UsageCard />
            <UserMenu />
          </div>
        </aside>

        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
      </div>
    </MeContext.Provider>
  );
}

function UsageCard() {
  const { me } = useMe();
  const plan = planOf(me.workspace.plan);
  const limit = me.limits.contacts;
  const used = me.usage.contacts;
  const ratio = isUnlimited(limit) ? 0 : Math.min(1, used / limit);
  const over = ratio >= 1;
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{plan.name} plan</span>
        <span className="tabular text-slate-500">
          {formatNumber(used)} / {isUnlimited(limit) ? "∞" : formatNumber(limit)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Contacts used" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx("h-full rounded-full", over ? "bg-rose-500" : ratio > 0.8 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">{over ? "Contact limit reached — automation is paused for new contacts." : "contacts"}</p>
      {me.workspace.plan !== "BUSINESS" && me.role === "OWNER" && (
        <Link href="/app/settings?tab=billing" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-brand-700 shadow-xs ring-1 ring-slate-200 hover:bg-brand-50">
          <Sparkles className="size-3.5" /> Upgrade
        </Link>
      )}
    </div>
  );
}

function WorkspaceSwitcher() {
  const { me } = useMe();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function switchTo(id: string) {
    if (id === me.workspace.id) return;
    try {
      await api("/api/workspaces/switch", { body: { id } });
      window.location.assign("/app");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <Menu
        align="left"
        width={232}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100"
          >
            <LogoMark size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-ink">{me.workspace.name}</span>
              <span className="block text-[11px] leading-tight text-slate-500">{brand.name}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Workspaces</div>
            {me.workspaces.map((w) => (
              <MenuItem
                key={w.id}
                onClick={() => {
                  close();
                  void switchTo(w.id);
                }}
                icon={w.id === me.workspace.id ? <Check className="text-brand-600" /> : <span className="block size-4" />}
              >
                {w.name}
              </MenuItem>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <MenuItem
              icon={<Plus />}
              onClick={() => {
                close();
                setCreating(true);
              }}
            >
              New workspace
            </MenuItem>
          </>
        )}
      </Menu>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a workspace"
        description="Each workspace has its own contacts, channels, flows and team — ideal for a separate brand or client."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!name.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/api/workspaces", { body: { name } });
                  window.location.assign("/app");
                } catch (err) {
                  toast(errorMessage(err), "error");
                  setBusy(false);
                }
              }}
            >
              Create workspace
            </Button>
          </>
        }
      >
        <Field label="Workspace name">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Coffee" maxLength={80} />
        </Field>
      </Modal>
    </div>
  );
}

function UserMenu() {
  const { me } = useMe();
  const router = useRouter();
  return (
    <Menu
      align="left"
      width={220}
      trigger={(props) => (
        <button type="button" {...props} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-100">
          <Avatar name={me.user.name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight text-ink">{me.user.name}</span>
            <span className="block truncate text-[11px] leading-tight text-slate-500">{me.user.email}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="-mt-0">
          <MenuItem
            icon={<UserRound />}
            onClick={() => {
              close();
              router.push("/app/settings?tab=profile");
            }}
          >
            Your profile
          </MenuItem>
          <MenuItem
            icon={<LogOut />}
            onClick={async () => {
              close();
              await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              window.location.assign("/login");
            }}
          >
            Sign out
          </MenuItem>
        </div>
      )}
    </Menu>
  );
}

/** Standard padded page container. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={clsx("mx-auto w-full px-5 py-7 sm:px-8", wide ? "max-w-[1400px]" : "max-w-[1120px]")}>{children}</div>;
}
