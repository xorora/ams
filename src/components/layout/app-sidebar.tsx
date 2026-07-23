"use client";

import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
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
  leaveRequestsIndicator?: ReactNode;
  lateRelaxationsIndicator?: ReactNode;
};

export function AppSidebar({
  user,
  hasLinkedEmployee = false,
  leaveRequestsIndicator = null,
  lateRelaxationsIndicator = null,
}: AppSidebarProps) {
  const navItems = getNavItemsForUser(user, { hasLinkedEmployee });
  const roleLabel =
    user.role === "admin" ? "Admin" : user.role === "accounting_admin" ? "Accounting" : "Employee";

  return (
    <Sidebar collapsible="icon" className="border-white/10">
      <SidebarHeader className="h-12 flex-row items-center border-b border-white/10 px-3 py-0 pr-12 md:pr-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pr-2">
        <BrandMark />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav
          items={navItems}
          leaveRequestsIndicator={leaveRequestsIndicator}
          lateRelaxationsIndicator={lateRelaxationsIndicator}
        />
      </SidebarContent>

      <SidebarFooter className="overflow-hidden border-t border-white/10 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:p-0">
        <div className="space-y-2 px-1 py-1 whitespace-nowrap group-data-[collapsible=icon]:hidden">
          <div className="text-xs">
            <p className="truncate font-medium text-white/90">{user.name ?? user.email}</p>
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
