import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "cv_session";

/**
 * Cheap first-pass routing on cookie presence. The real session check happens
 * on the server for every page and API call – this only avoids a flash of the
 * wrong screen.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/app") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/app" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
