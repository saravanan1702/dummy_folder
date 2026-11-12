const DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef0123456789abcdef";

let warned = false;

/** Secret used for encrypting channel credentials and signing widget tokens. */
export function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set to a random string of at least 32 characters in production.");
  }
  if (!warned) {
    warned = true;
    console.warn("[env] APP_SECRET is missing or too short – using an insecure development secret.");
  }
  return DEV_SECRET;
}

/** Public base URL of the app (no trailing slash). Falls back to the request's own origin. */
export function appUrl(req?: Request): string {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.headers.get("host");
    if (host) return `${proto ?? new URL(req.url).protocol.replace(":", "")}://${host}`;
    return new URL(req.url).origin;
  }
  return "http://localhost:3000";
}

export const isProd = process.env.NODE_ENV === "production";
