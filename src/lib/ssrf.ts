import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6IsPrivate(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  return (
    lower.startsWith("fc") ||
    lower.startsWith("fd") || // unique local
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") || // link-local
    lower.startsWith("ff") || // multicast
    lower.startsWith("::ffff:") ||
    lower.startsWith("64:ff9b:")
  );
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true;
}

/**
 * Validates that a customer-supplied URL is safe to call from our servers:
 * https only, and it must not resolve to a private, loopback or link-local address.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  const allowInsecure = process.env.ALLOW_PRIVATE_WEBHOOKS === "1";
  if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) {
    throw new Error("Only https:// URLs are allowed");
  }
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  if (allowInsecure) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error("Could not resolve host");
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("URL points to a private network address");
  }
  return url;
}

/** POSTs JSON to a customer webhook with SSRF protection, no redirects and a short timeout. */
export async function postWebhook(rawUrl: string, body: unknown): Promise<{ ok: boolean; status: number }> {
  const url = await assertPublicUrl(rawUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "chat-automation-webhook/1.0" },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  return { ok: res.status >= 200 && res.status < 300, status: res.status };
}
