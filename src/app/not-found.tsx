import Link from "next/link";
import { LogoMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark size={44} />
      <h1 className="mt-6 text-[28px] font-bold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/app" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Go to dashboard</Link>
    </div>
  );
}
