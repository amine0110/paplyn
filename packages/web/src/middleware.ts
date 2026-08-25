import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isProtectedPath, loginRedirectUrl } from "@/lib/protected-routes";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = getSessionCookie(request);
  if (!sessionToken) {
    const loginUrl = new URL(loginRedirectUrl(pathname), request.url);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
    "/project/:path*",
  ],
};
