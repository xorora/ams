import { cookies } from "next/headers";
import { Suspense } from "react";
import type { Session } from "next-auth";
import { ApplicationShell } from "@/components/layout/application-shell";
import { PendingLeaveIndicator } from "@/components/layout/pending-leave-indicator";
import { getCompanies } from "@/lib/admin/selected-company";
import {
  COMPANY_COOKIE,
  resolveSelectedCompanyId,
} from "@/lib/admin/selected-company-utils";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const linkedEmployee = session?.user
    ? hasLinkedEmployee({ user: session.user } as Session)
    : false;
  const isAdmin = session?.user?.role === "admin";

  const [companies, cookieStore] = isAdmin
    ? await Promise.all([getCompanies(), cookies()])
    : [[], null];

  const selectedCompanyId = isAdmin
    ? resolveSelectedCompanyId(companies, cookieStore?.get(COMPANY_COOKIE)?.value)
    : null;

  return (
    <ApplicationShell
      user={session?.user}
      hasLinkedEmployee={linkedEmployee}
      companies={companies}
      selectedCompanyId={selectedCompanyId}
      leaveRequestsIndicator={
        isAdmin ? (
          <Suspense fallback={null}>
            <PendingLeaveIndicator companyId={selectedCompanyId} />
          </Suspense>
        ) : null
      }
    >
      {children}
    </ApplicationShell>
  );
}
