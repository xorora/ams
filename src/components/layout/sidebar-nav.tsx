"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NavItem } from "@/lib/auth/navigation";
import { isNavItemActive } from "@/lib/auth/navigation";

type SidebarNavProps = {
  items: NavItem[];
  leaveRequestsIndicator?: ReactNode;
  lateRelaxationsIndicator?: ReactNode;
};

export function SidebarNav({
  items,
  leaveRequestsIndicator = null,
  lateRelaxationsIndicator = null,
}: SidebarNavProps) {
  const pathname = usePathname();
  const employeeItems = items.filter((item) => !item.adminOnly);
  const adminItems = items.filter((item) => item.adminOnly);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {employeeItems.map((item) => (
              <NavMenuItem key={item.href} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {adminItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <NavMenuItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  indicator={
                    item.href === "/admin/leave"
                      ? leaveRequestsIndicator
                      : item.href === "/admin/relaxations"
                        ? lateRelaxationsIndicator
                        : null
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

function NavMenuItem({
  item,
  pathname,
  indicator = null,
}: {
  item: NavItem;
  pathname: string;
  indicator?: ReactNode;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        render={
          <Link
            href={item.href}
            onClick={() => {
              if (isMobile) {
                setOpenMobile(false);
              }
            }}
          />
        }
      >
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {/*
        Absolute on the menu item (not inside the overflow-hidden button) so the red dot
        is not clipped. Renders nothing when the streamed indicator resolves to null.
      */}
      {indicator != null ? (
        <span className="pointer-events-none absolute top-1.5 right-1.5 flex items-center justify-center group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1">
          {indicator}
        </span>
      ) : null}
    </SidebarMenuItem>
  );
}
