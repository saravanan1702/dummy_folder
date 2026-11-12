import Link from "next/link";
import { Logo } from "@/components/brand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex h-16 max-w-[760px] items-center px-5">
          <Link href="/"><Logo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-5 py-12 text-[15px] leading-relaxed text-slate-700 [&_h1]:mb-2 [&_h1]:text-[32px] [&_h1]:font-bold [&_h1]:text-ink [&_h2]:mb-2 [&_h2]:mt-9 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>
    </div>
  );
}
