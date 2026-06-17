"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { isPublicPath } from "@/lib/auth/navigation";

type ApplicationShellProps = {
  user: Session["user"] | null | undefined;
  hasLinkedEmployee?: boolean;
  companies?: CompanyOption[];
  selectedCompanyId?: string | null;
  children: React.ReactNode;
};

export function ApplicationShell({
  user,
  hasLinkedEmployee = false,
  companies = [],
  selectedCompanyId = null,
  children,
}: ApplicationShellProps) {
  const pathname = usePathname();
  const showAppChrome = user != null && !isPublicPath(pathname);

  if (!showAppChrome || !user) {
    return (
      <div className="flex min-h-svh flex-1 flex-col">
        {children}
        <Toaster richColors closeButton />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar user={user} hasLinkedEmployee={hasLinkedEmployee} />
        <SidebarInset className="h-svh overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            {user.role === "admin" && companies.length > 0 && selectedCompanyId ? (
              <div className="ml-auto">
                <CompanySwitcher companies={companies} selectedCompanyId={selectedCompanyId} />
              </div>
            ) : null}
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors closeButton />
    </TooltipProvider>
  );
}
