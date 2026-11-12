"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Field } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";

function FormShell({
  title,
  subtitle,
  error,
  children,
  onSubmit,
}: {
  title: string;
  subtitle?: ReactNode;
  error: string | null;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="mt-6 space-y-4">{children}</div>
    </form>
  );
}

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email, password } });
      const invite = params.get("invite");
      if (invite) {
        await api("/api/invites/accept", { body: { token: invite } }).catch(() => undefined);
      }
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <FormShell title="Welcome back" subtitle="Sign in to your workspace." error={error} onSubmit={submit}>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Password
            <Link href="/forgot-password" className="font-normal text-brand-700 hover:underline" tabIndex={-1}>
              Forgot password?
            </Link>
          </span>
        }
      >
        <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={busy} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-500">
        New here?{" "}
        <Link href={params.get("invite") ? `/invite/${params.get("invite")}` : "/signup"} className="font-medium text-brand-700 hover:underline">
          Create a free account
        </Link>
      </p>
    </FormShell>
  );
}

export function SignupForm({ invite }: { invite?: { token: string; workspace: string; email: string } }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invite?.email ?? "");
  const [workspaceName, setWorkspaceName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", {
        body: { name, email, password, workspaceName: workspaceName || undefined, inviteToken: invite?.token },
      });
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <FormShell
      title={invite ? `Join ${invite.workspace}` : "Create your free account"}
      subtitle={invite ? "You've been invited to collaborate. Create an account to accept." : "Launch your first chatbot in minutes. No credit card required."}
      error={error}
      onSubmit={submit}
    >
      <Field label="Your name">
        <input className="input" autoComplete="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Work email">
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {!invite && (
        <Field label="Business name" hint="This becomes the name of your workspace. You can change it later.">
          <input className="input" autoComplete="organization" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
        </Field>
      )}
      <Field label="Password" hint="At least 8 characters.">
        <input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={busy} className="w-full">
        {invite ? "Accept invitation" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href={invite ? `/login?invite=${invite.token}` : "/login"} className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </FormShell>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          If an account exists for <span className="font-medium text-ink">{email}</span>, we&apos;ve sent a link to reset your
          password. It expires in one hour.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <FormShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link." error={error} onSubmit={submit}>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={busy} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </FormShell>
  );
}

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is incomplete. Please request a new one.");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { body: { token, password } });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <FormShell title="Choose a new password" error={error} onSubmit={submit}>
      <Field label="New password" hint="At least 8 characters.">
        <input className="input" type="password" autoComplete="new-password" required minLength={8} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={busy} disabled={!token} className="w-full">
        Update password
      </Button>
    </FormShell>
  );
}

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Button
        size="lg"
        className="w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/invites/accept", { body: { token } });
            router.replace("/app");
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}
