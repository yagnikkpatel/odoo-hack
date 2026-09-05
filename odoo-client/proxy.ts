import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth-constants";

export function proxy(request: NextRequest) {
  // A cheap routing guard only: the protected layout verifies the cookie with
  // the backend. Possessing an arbitrary cookie never establishes a session.
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Preserve the existing module availability redirects.
  if (
    /^\/(time-off|payroll|payslips|reports|dashboard|dashboards)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  ) {
    return NextResponse.redirect(new URL("/employees", request.url));
  }
  return NextResponse.next();
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
