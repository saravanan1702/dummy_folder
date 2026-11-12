import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getAuth, type AuthContext } from "./auth";
import type { Role } from "@/generated/prisma/client";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`);
export const forbidden = (msg = "You don't have permission to do that") => new ApiError(403, msg);

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
    return NextResponse.json({ error: `${path}${first?.message ?? "Invalid input"}` }, { status: 400 });
  }
  // Prisma unique constraint
  if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
    return NextResponse.json({ error: "That already exists" }, { status: 409 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/**
 * CSRF defence for cookie-authenticated requests: state-changing requests must
 * come from our own origin. Browsers always send Origin on cross-site POSTs.
 */
export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client (no ambient cookies to abuse)
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  const allowed = new Set<string>();
  if (host) allowed.add(host);
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).host);
    } catch {
      /* ignore malformed APP_URL */
    }
  }
  if (!originHost || !allowed.has(originHost)) {
    throw new ApiError(403, "Cross-origin request blocked");
  }
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}

type RouteCtx<P> = { params: Promise<P> };

interface AuthedArgs<P> extends AuthContext {
  req: NextRequest;
  params: P;
}

/** Route handler for signed-in dashboard users, scoped to their active workspace. */
export function authed<P = Record<string, never>>(
  fn: (args: AuthedArgs<P>) => Promise<unknown>,
  opts: { roles?: Role[] } = {},
) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const auth = await getAuth();
      if (!auth) throw new ApiError(401, "You are not signed in");
      if (opts.roles && !opts.roles.includes(auth.membership.role)) throw forbidden();
      const result = await fn({ req, params: await ctx.params, ...auth });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Route handler without authentication (auth endpoints, webhooks, widget). */
export function open<P = Record<string, never>>(
  fn: (args: { req: NextRequest; params: P }) => Promise<unknown>,
  opts: { sameOrigin?: boolean } = {},
) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      if (opts.sameOrigin) assertSameOrigin(req);
      const result = await fn({ req, params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export const MANAGERS: Role[] = ["OWNER", "ADMIN"];

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function pageParams(req: NextRequest, defaultSize = 25, maxSize = 100) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const size = Math.min(maxSize, Math.max(1, Number.parseInt(sp.get("size") ?? `${defaultSize}`, 10) || defaultSize));
  return { page, size, skip: (page - 1) * size, take: size };
}
