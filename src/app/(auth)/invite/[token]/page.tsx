import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteButton, SignupForm } from "@/components/auth-forms";
import { getAuth } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { workspace: { select: { name: true } } },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-ink">This invitation has expired</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Ask the person who invited you to send a new link, or sign in if you already have an account.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  const auth = await getAuth();
  if (auth) {
    return (
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-ink">Join {invite.workspace.name}</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-slate-500">
          You&apos;re signed in as <span className="font-medium text-ink">{auth.user.email}</span>. Accept to add this
          workspace to your account.
        </p>
        <AcceptInviteButton token={token} />
      </div>
    );
  }

  return <SignupForm invite={{ token, workspace: invite.workspace.name, email: invite.email }} />;
}
