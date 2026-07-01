"use client";

import type { Session } from "next-auth";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getNavItemsForUser } from "@/lib/auth/navigation";

type AppSidebarProps = {
  user: Session["user"];
  hasLinkedEmployee?: boolean;
};

export function AppSidebar({ user, hasLinkedEmployee = false }: AppSidebarProps) {
  const navItems = getNavItemsForUser(user, { hasLinkedEmployee });
  const roleLabel =
    user.role === "admin" ? "Admin" : user.role === "accounting_admin" ? "Accounting" : "Employee";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b h-12 flex items-start justify-center">
        <p className="truncate font-semibold tracking-tight">AMS</p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav items={navItems} />
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="space-y-2 px-1 py-1 group-data-[collapsible=icon]:hidden">
          <div className="text-xs">
            <p className="truncate font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-muted-foreground">{user.email}</p>
            <p className="mt-0.5 text-muted-foreground">{roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
