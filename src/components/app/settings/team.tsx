"use client";

import { Mail, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { CopyField } from "@/components/app/copy";
import { useCanManage, useMe } from "@/components/app/shell";
import { Avatar, Badge, Button, ConfirmDialog, Field, IconButton, Modal, PageLoader, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import { formatDate } from "@/lib/format";

interface Member {
  id: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  joinedAt: string;
  userId: string;
  name: string;
  email: string;
}
interface Invite {
  id: string;
  email: string;
  role: "ADMIN" | "AGENT";
  expiresAt: string;
}

const ROLE_HELP = {
  OWNER: "Full access, including billing",
  ADMIN: "Manage channels, team and settings",
  AGENT: "Chat with contacts and build flows",
};

export function TeamSettings() {
  const toast = useToast();
  const canManage = useCanManage();
  const { me, refresh } = useMe();
  const members = useSWR<{ members: Member[] }>("/api/members");
  const invites = useSWR<{ invites: Invite[] }>(canManage ? "/api/invites" : null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "AGENT">("AGENT");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  if (!members.data) return <PageLoader />;

  async function invite() {
    setBusy(true);
    try {
      const res = await api<{ link: string }>("/api/invites", { body: { email, role } });
      setLink(res.link);
      void invites.mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function closeInvite() {
    setInviting(false);
    setLink(null);
    setEmail("");
    setRole("AGENT");
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Team members</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {me.usage.seats} of {me.limits.seats} seat{me.limits.seats === 1 ? "" : "s"} used
            </p>
          </div>
          {canManage && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
              Invite teammate
            </Button>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {members.data.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Avatar name={m.name} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {m.name} {m.userId === me.user.id && <span className="font-normal text-slate-400">(you)</span>}
                </div>
                <div className="truncate text-[13px] text-slate-500">{m.email}</div>
              </div>
              {canManage && m.role !== "OWNER" && m.userId !== me.user.id ? (
                <select
                  className="input w-auto"
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  onChange={async (e) => {
                    try {
                      await api(`/api/members/${m.id}`, { method: "PATCH", body: { role: e.target.value } });
                      void members.mutate();
                      toast("Role updated");
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="AGENT">Agent</option>
                </select>
              ) : (
                <Badge tone={m.role === "OWNER" ? "brand" : "neutral"}>{m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Agent"}</Badge>
              )}
              {m.role !== "OWNER" && (canManage || m.userId === me.user.id) && (
                <IconButton label={m.userId === me.user.id ? "Leave workspace" : `Remove ${m.name}`} onClick={() => setRemoving(m)} className="hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (invites.data?.invites.length ?? 0) > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Pending invitations</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invites.data!.invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex size-[38px] items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Mail className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{i.email}</div>
                  <div className="text-[13px] text-slate-500">
                    {i.role === "ADMIN" ? "Admin" : "Agent"} · expires {formatDate(i.expiresAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await api(`/api/invites/${i.id}`, { method: "DELETE" });
                      void invites.mutate();
                    } catch (err) {
                      toast(errorMessage(err), "error");
                    }
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={inviting}
        onClose={closeInvite}
        title={link ? "Invitation ready" : "Invite a teammate"}
        footer={
          link ? (
            <Button onClick={closeInvite}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeInvite}>
                Cancel
              </Button>
              <Button loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={invite}>
                Create invitation
              </Button>
            </>
          )
        }
      >
        {link ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600">
              Share this link with <span className="font-medium text-ink">{email}</span>. It works once and expires in 7 days. If email delivery is set up, we&apos;ve sent it to them too.
            </p>
            <CopyField value={link} multiline />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Email address">
              <input className="input" type="email" autoFocus value={email} placeholder="teammate@company.com" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Role" hint={ROLE_HELP[role]}>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "AGENT")}>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing?.userId === me.user.id ? "Leave this workspace?" : `Remove ${removing?.name}?`}
        confirmLabel={removing?.userId === me.user.id ? "Leave" : "Remove"}
        onConfirm={async () => {
          try {
            await api(`/api/members/${removing!.id}`, { method: "DELETE" });
            if (removing!.userId === me.user.id) {
              window.location.href = "/app";
              return;
            }
            void members.mutate();
            refresh();
            toast("Member removed");
          } catch (err) {
            toast(errorMessage(err), "error");
          }
        }}
      >
        They lose access to this workspace immediately. Conversations assigned to them become unassigned.
      </ConfirmDialog>
    </div>
  );
}
