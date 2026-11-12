"use client";

import { Check, Copy } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

const noop = () => () => {};
/** The page origin on the client, "" during server render (no hydration mismatch). */
export function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be blocked (insecure origin); fall back to a hidden textarea.
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return { copied, copy };
}

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="secondary" size={size} icon={copied ? <Check className="size-4 text-mint-600" /> : <Copy className="size-4" />} onClick={() => copy(text)}>
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Read-only value with a copy button – for links, snippets and tokens. */
export function CopyField({ value, mono = true, multiline }: { value: string; mono?: boolean; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <code
        className={`min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] leading-relaxed text-slate-800 ${mono ? "font-mono" : ""} ${
          multiline ? "whitespace-pre-wrap break-all" : "overflow-x-auto whitespace-nowrap"
        }`}
      >
        {value}
      </code>
      <CopyButton text={value} />
    </div>
  );
}

export function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#16132d", light: "#ffffff" } })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  if (!src) return <div className="rounded-lg bg-slate-100" style={{ width: size, height: size }} />;
  return (
    <a href={src} download="qr-code.png" title="Download QR code" className="block shrink-0 rounded-lg border border-slate-200 p-1.5 hover:border-brand-400">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR code" width={size} height={size} />
    </a>
  );
}
