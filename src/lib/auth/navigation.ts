import type { LucideIcon } from "lucide-react";
import { CalendarDays, FileSpreadsheet, LayoutDashboard, Users } from "lucide-react";
import type { Session } from "next-auth";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, only `href` matches (not child paths). */
  exact?: boolean;
  /** Shown in sidebar section label (admin-only block). */
  adminOnly?: boolean;
};

export function getDefaultAuthenticatedPath(role: Session["user"]["role"]): string {
  return role === "admin" ? "/admin/employees" : "/dashboard";
}

/** Employees must link an admin-created record before using attendance. */
export function needsEmployeeRegistration(user: Session["user"]): boolean {
  return user.role === "employee" && !hasLinkedEmployee({ user } as Session);
}

export function getPostAuthRedirect(user: Session["user"]): string {
  if (needsEmployeeRegistration(user)) {
    return "/register";
  }
  return getDefaultAuthenticatedPath(user.role);
}

export function getNavItemsForUser(user: Session["user"]): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  ];

  if (user.role === "admin") {
    items.push(
      { href: "/admin/employees", label: "Employees", icon: Users, adminOnly: true },
      {
        href: "/admin/attendance",
        label: "Attendance",
        icon: CalendarDays,
        adminOnly: true,
      },
      { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet, adminOnly: true },
    );
  }

  return items;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Routes that render without the app sidebar chrome. */
export const PUBLIC_PATH_PREFIXES = ["/login", "/register"] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
