import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDefaultAuthenticatedPath } from "@/lib/auth/navigation";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  const isProtectedPage = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  const isAttendanceApi = pathname.startsWith("/api/attendance");

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (pathname === "/login" && isLoggedIn) {
    const home = getDefaultAuthenticatedPath(req.auth?.user?.role ?? "employee");
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  if (pathname === "/admin" && isLoggedIn) {
    const home = getDefaultAuthenticatedPath(req.auth?.user?.role ?? "employee");
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  if ((isProtectedPage || isAdminRoute || isAttendanceApi) && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && req.auth?.user?.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/attendance/:path*",
  ],
};
