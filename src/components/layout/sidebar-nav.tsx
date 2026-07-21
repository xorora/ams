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
import { cn } from "@/lib/utils";

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
      <SidebarGroup className="px-2 py-2">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {employeeItems.map((item) => (
              <NavMenuItem key={item.href} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {adminItems.length > 0 && (
        <SidebarGroup className="px-2 py-2">
          <SidebarGroupLabel className="mb-1 px-2 font-mono text-[10px] tracking-[0.16em] text-[#7d859e] uppercase">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
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
        size="lg"
        className={cn(
          "h-11 rounded-xl px-2.5 transition-colors [&_svg]:size-[1.125rem]",
          "group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:rounded-xl!",
          active
            ? "bg-[#14204a] font-medium text-white shadow-[inset_0_0_0_1px_rgba(242,107,33,0.35)] hover:bg-[#1a2958] hover:text-white"
            : "text-[#c8cce0] hover:bg-white/[0.06] hover:text-white",
        )}
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
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            "group-data-[collapsible=icon]:size-full",
            active
              ? "bg-[#f26b21]/18 text-[#f26b21]"
              : "bg-white/[0.05] text-[#a8aec4] group-hover/menu-button:bg-white/[0.08] group-hover/menu-button:text-[#eceef5]",
          )}
        >
          <Icon strokeWidth={1.75} aria-hidden />
        </span>
        <span className="truncate">{item.label}</span>
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
