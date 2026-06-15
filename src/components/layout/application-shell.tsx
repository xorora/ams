"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { isPublicPath } from "@/lib/auth/navigation";

type ApplicationShellProps = {
  user: Session["user"] | null | undefined;
  canAccessLeave?: boolean;
  companies?: CompanyOption[];
  selectedCompanyId?: string | null;
  children: React.ReactNode;
};

export function ApplicationShell({
  user,
  canAccessLeave = false,
  companies = [],
  selectedCompanyId = null,
  children,
}: ApplicationShellProps) {
  const pathname = usePathname();
  const showAppChrome = user != null && !isPublicPath(pathname);

  if (!showAppChrome || !user) {
    return <div className="flex min-h-svh flex-1 flex-col">{children}</div>;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} canAccessLeave={canAccessLeave} />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            {user.role === "admin" && companies.length > 0 && selectedCompanyId ? (
              <div className="ml-auto">
                <CompanySwitcher companies={companies} selectedCompanyId={selectedCompanyId} />
              </div>
            ) : null}
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
