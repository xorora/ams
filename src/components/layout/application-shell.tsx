"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { isPublicPath } from "@/lib/auth/navigation";

type ApplicationShellProps = {
  user: Session["user"] | null | undefined;
  hasLinkedEmployee?: boolean;
  companies?: CompanyOption[];
  selectedCompanyId?: string | null;
  leaveRequestsIndicator?: ReactNode;
  lateRelaxationsIndicator?: ReactNode;
  children: React.ReactNode;
};

export function ApplicationShell({
  user,
  hasLinkedEmployee = false,
  companies = [],
  selectedCompanyId = null,
  leaveRequestsIndicator = null,
  lateRelaxationsIndicator = null,
  children,
}: ApplicationShellProps) {
  const pathname = usePathname();
  const showAppChrome = user != null && !isPublicPath(pathname);

  if (!showAppChrome || !user) {
    return <div className="flex min-h-dvh flex-1 flex-col">{children}</div>;
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="h-dvh overflow-hidden">
        <AppSidebar
          user={user}
          hasLinkedEmployee={hasLinkedEmployee}
          leaveRequestsIndicator={leaveRequestsIndicator}
          lateRelaxationsIndicator={lateRelaxationsIndicator}
        />
        <SidebarInset className="flex h-dvh min-h-0 flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 pt-[max(0px,env(safe-area-inset-top))]">
            <SidebarTrigger className="-ml-1 size-9" />
            {user.role === "admin" && companies.length > 0 && selectedCompanyId ? (
              <div className="ml-auto min-w-0 max-w-[55%]">
                <CompanySwitcher companies={companies} selectedCompanyId={selectedCompanyId} />
              </div>
            ) : null}
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[max(0px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
