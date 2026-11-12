import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { getAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; invite?: string }> }) {
  const sp = await searchParams;
  if (!sp.invite && (await getAuth())) redirect("/app");
  return (
    <>
      {sp.reset && (
        <div className="mb-6 rounded-lg border border-mint-100 bg-mint-50 px-3.5 py-2.5 text-sm text-mint-700">
          Your password was updated. Sign in with your new password.
        </div>
      )}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
