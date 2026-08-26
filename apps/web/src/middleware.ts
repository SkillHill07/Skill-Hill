import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Routes that should redirect to /dashboard when the user already has a
 * session cookie (accessToken).  The API sets HttpOnly cookies, so the
 * middleware only checks for their *presence* — not validity — as a fast
 * client-side gate.  Real auth verification happens server-side.
 */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only guard auth routes
  if (AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    const hasToken = request.cookies.get("accessToken")
    if (hasToken) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
}
