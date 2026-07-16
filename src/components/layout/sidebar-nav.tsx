"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  pendingLeaveRequestCount?: number;
};

export function SidebarNav({ items, pendingLeaveRequestCount = 0 }: SidebarNavProps) {
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
                  showDot={item.href === "/admin/leave" && pendingLeaveRequestCount > 0}
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
  showDot = false,
}: {
  item: NavItem;
  pathname: string;
  showDot?: boolean;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={showDot ? `${item.label} (new requests)` : item.label}
        render={<Link href={item.href} />}
      >
        <span className="relative inline-flex">
          <Icon />
          {showDot ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar"
            />
          ) : null}
        </span>
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
