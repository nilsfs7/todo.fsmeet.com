import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "./lib/session-token";
import { publicOrigin } from "./lib/site";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next();
  }

  const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const login = new URL("/login", publicOrigin(request));
  if (pathname !== "/") login.searchParams.set("returnTo", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
