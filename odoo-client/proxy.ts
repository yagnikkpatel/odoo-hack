import { type NextRequest, NextResponse } from "next/server";
import {
  PERSISTENT_SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/features/auth/auth-constants";
import {
  applySessionCookies,
  clearSessionCookies,
} from "@/features/auth/auth-cookies";
import { requestTokenRefresh } from "@/features/auth/auth-tokens";

export async function proxy(request: NextRequest) {
  // A cheap routing guard only: the protected layout verifies the cookie with
  // the backend. Possessing an arbitrary cookie never establishes a session.
  if (request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.next();
  }

  // The short-lived access token has expired. Renew it here, before the page
  // renders, so a returning visitor with a valid refresh token stays signed in.
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    const tokens = await requestTokenRefresh(refreshToken);

    if (tokens) {
      const persistent =
        request.cookies.get(PERSISTENT_SESSION_COOKIE_NAME)?.value === "1";

      // Rewrite the request cookie too, so this render's server components read
      // the new token rather than the expired one.
      request.cookies.set(SESSION_COOKIE_NAME, tokens.accessToken);

      return applySessionCookies(
        NextResponse.next({ request }),
        tokens,
        persistent,
      );
    }
  }

  return clearSessionCookies(
    NextResponse.redirect(new URL("/login", request.url)),
  );
}

export const config = {
  matcher: [
    "/employees/:path*",
    "/contracts/:path*",
    "/attendance/:path*",
    "/kanban/:path*",
    "/opportunities/:path*",
    "/time-off/:path*",
    "/payroll/:path*",
    "/payslips/:path*",
    "/reports/:path*",
    "/dashboard/:path*",
    "/dashboards/:path*",
  ],
};
