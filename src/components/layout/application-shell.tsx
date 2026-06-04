"use client";

import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isPublicPath } from "@/lib/auth/navigation";

type ApplicationShellProps = {
  user: Session["user"] | null | undefined;
  children: React.ReactNode;
};

export function ApplicationShell({ user, children }: ApplicationShellProps) {
  const pathname = usePathname();
  const showAppChrome = user != null && !isPublicPath(pathname);

  if (!showAppChrome || !user) {
    return <div className="flex min-h-svh flex-1 flex-col">{children}</div>;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="ml-auto">
              <ModeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
