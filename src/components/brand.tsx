import clsx from "clsx";
import { Camera, Globe, MessagesSquare, Phone, Send } from "lucide-react";
import { brand } from "@/config/brand";

/** Product mark: two overlapping chat bubbles forming a loop. Original artwork – swap freely. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="#6246EA" />
      <path
        d="M9 10.5A3.5 3.5 0 0 1 12.5 7h7A3.5 3.5 0 0 1 23 10.5v4A3.5 3.5 0 0 1 19.5 18H15l-3.6 2.9c-.5.4-1.2 0-1.2-.6V17.6A3.5 3.5 0 0 1 9 14.5v-4Z"
        fill="#fff"
      />
      <path
        d="M17.2 20.4h2.6l3 2.4c.5.4 1.2 0 1.2-.6v-2.1a3.3 3.3 0 0 0 1.5-2.8v-2.6"
        stroke="#B4A6FB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.2" cy="12.5" r="1.25" fill="#6246EA" />
      <circle cx="16" cy="12.5" r="1.25" fill="#6246EA" />
      <circle cx="18.8" cy="12.5" r="1.25" fill="#6246EA" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={clsx("font-display text-[19px] font-bold tracking-tight", light ? "text-white" : "text-ink")}>
        {brand.name}
      </span>
    </span>
  );
}

export type ChannelKind = "WEBCHAT" | "TELEGRAM" | "WHATSAPP" | "MESSENGER" | "INSTAGRAM";

// Generic glyphs + colours instead of third-party logos, which are trademarks.
const CHANNEL_STYLE: Record<ChannelKind, { icon: typeof Globe; bg: string; fg: string; label: string }> = {
  WEBCHAT: { icon: Globe, bg: "bg-brand-100", fg: "text-brand-700", label: "Website chat" },
  TELEGRAM: { icon: Send, bg: "bg-sky-100", fg: "text-sky-700", label: "Telegram" },
  WHATSAPP: { icon: Phone, bg: "bg-emerald-100", fg: "text-emerald-700", label: "WhatsApp" },
  MESSENGER: { icon: MessagesSquare, bg: "bg-blue-100", fg: "text-blue-700", label: "Messenger" },
  INSTAGRAM: { icon: Camera, bg: "bg-pink-100", fg: "text-pink-700", label: "Instagram" },
};

export function channelLabel(type: string | null | undefined): string {
  return CHANNEL_STYLE[(type ?? "WEBCHAT") as ChannelKind]?.label ?? "Chat";
}

export function ChannelIcon({ type, size = 20, className }: { type: string | null | undefined; size?: number; className?: string }) {
  const style = CHANNEL_STYLE[(type ?? "WEBCHAT") as ChannelKind] ?? CHANNEL_STYLE.WEBCHAT;
  const Icon = style.icon;
  return (
    <span
      title={style.label}
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-md", style.bg, style.fg, className)}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} aria-hidden />
      <span className="sr-only">{style.label}</span>
    </span>
  );
}
