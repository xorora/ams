import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPostAuthRedirect, needsEmployeeRegistration } from "@/lib/auth/navigation";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const user = req.auth?.user;

  const isProtectedPage = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  const isAttendanceApi = pathname.startsWith("/api/attendance");

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

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
    return;
  }

  if (pathname === "/admin" && isLoggedIn && user) {
    return NextResponse.redirect(new URL(getPostAuthRedirect(user), req.nextUrl.origin));
  }

  if ((isProtectedPage || isAdminRoute || isAttendanceApi) && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signInUrl = new URL("/", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (user && needsEmployeeRegistration(user)) {
    const mustRegister = pathname.startsWith("/dashboard") || isAttendanceApi;
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

  if (isAdminRoute && user?.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/",
    "/register",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/attendance/:path*",
  ],
};
