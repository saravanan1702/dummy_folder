"use client";

import { LogoMark } from "@/components/brand";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark size={44} />
      <h1 className="mt-6 text-[28px] font-bold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">An unexpected error occurred. Please try again — if it keeps happening, contact support.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Try again</button>
    </div>
  );
}
