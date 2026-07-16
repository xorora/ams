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
} from "@/components/ui/sidebar";
import type { NavItem } from "@/lib/auth/navigation";
import { isNavItemActive } from "@/lib/auth/navigation";

type SidebarNavProps = {
  items: NavItem[];
  leaveRequestsIndicator?: ReactNode;
};

export function SidebarNav({ items, leaveRequestsIndicator = null }: SidebarNavProps) {
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
                  indicator={item.href === "/admin/leave" ? leaveRequestsIndicator : null}
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

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        render={<Link href={item.href} />}
      >
        <span className="relative inline-flex">
          <Icon />
          {indicator}
        </span>
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
