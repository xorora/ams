import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import {
  getDefaultAuthenticatedPath,
  getPostAuthRedirect,
  needsEmployeeRegistration,
} from "@/lib/auth/navigation";

function isAccountingRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/accounting") || pathname.startsWith("/api/admin/accounting");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isSalaryRoute(pathname: string): boolean {
  return pathname.startsWith("/salary") || pathname.startsWith("/api/salary");
}

function canAccessSalaryRoute(user: Session["user"]): boolean {
  return user.role === "employee" && hasLinkedEmployee({ user } as Session);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const user = req.auth?.user;

  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/admin");

  const isAttendanceApi = pathname.startsWith("/api/attendance");
  const isSalaryApi = pathname.startsWith("/api/salary");

  if (pathname === "/" && isLoggedIn && user) {
    return NextResponse.redirect(new URL(getPostAuthRedirect(user), req.nextUrl.origin));
  }

  if (pathname === "/register") {
    if (!isLoggedIn) {
      const signInUrl = new URL("/", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", "/register");
      return NextResponse.redirect(signInUrl);
    }

    if (user && !needsEmployeeRegistration(user)) {
      return NextResponse.redirect(new URL(getPostAuthRedirect(user), req.nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (pathname === "/admin" && isLoggedIn && user) {
    return NextResponse.redirect(new URL(getPostAuthRedirect(user), req.nextUrl.origin));
  }

  if (
    (isProtectedPage || isAdminRoute(pathname) || isAttendanceApi || isSalaryApi) &&
    !isLoggedIn
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signInUrl = new URL("/", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (user && needsEmployeeRegistration(user)) {
    const mustRegister =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/attendance") ||
      pathname.startsWith("/leave") ||
      pathname.startsWith("/salary") ||
      isAttendanceApi ||
      isSalaryApi;
    if (mustRegister) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden", code: "REGISTRATION_REQUIRED" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/register", req.nextUrl.origin));
    }
  }

  if (isSalaryRoute(pathname) && user) {
    if (!canAccessSalaryRoute(user)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
  }

  if (isAdminRoute(pathname) && user) {
    if (isAccountingRoute(pathname)) {
      if (user.role !== "admin" && user.role !== "accounting_admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
      }
    } else if (user.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const redirectPath =
        user.role === "accounting_admin" ? getDefaultAuthenticatedPath(user.role) : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: [
    "/",
    "/register",
    "/dashboard/:path*",
    "/attendance/:path*",
    "/leave",
    "/leave/:path*",
    "/salary",
    "/salary/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/salary/:path*",
    "/api/attendance/:path*",
  ],
};
