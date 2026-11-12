import { Check } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { brand } from "@/config/brand";

const POINTS = [
  "Build chatbots visually — no code needed",
  "One inbox for Telegram, WhatsApp, Messenger, Instagram and your website",
  "Capture leads and follow up automatically",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="self-start">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 10%, rgba(143,122,244,.55) 0%, transparent 70%), radial-gradient(50% 45% at 10% 90%, rgba(44,182,125,.35) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <h2 className="max-w-md text-[34px] font-bold leading-[1.15] text-white">
            Turn every conversation into a customer.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-brand-100">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mint-500 text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>

          {/* Decorative chat preview */}
          <div className="mt-12 max-w-sm space-y-3" aria-hidden>
            <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur">
              Hi! 👋 Want 10% off your first order?
            </div>
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm text-white">
              Yes please!
            </div>
            <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur">
              Great — what&apos;s your email? I&apos;ll send the code right over.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
