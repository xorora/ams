import { LateRelaxationManager } from "@/components/late-relaxation/late-relaxation-manager";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireAdminSession } from "@/lib/auth/require-session";
import {
  getCurrentYearMonth,
  listLateRelaxationRequests,
} from "@/lib/late-relaxation/late-relaxation-service";
import { serializeLateRelaxationRequest } from "@/lib/late-relaxation/serialize";
import type { LateRelaxationStatus } from "@/lib/late-relaxation/types";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    yearMonth?: string;
  }>;
};

export default async function AdminRelaxationsPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;

  const statusParam = params.status;
  const status =
    statusParam === "pending" ||
    statusParam === "approved" ||
    statusParam === "rejected" ||
    statusParam === "cancelled"
      ? (statusParam as LateRelaxationStatus)
      : undefined;

  const yearMonth =
    params.yearMonth && /^\d{4}-\d{2}$/.test(params.yearMonth) ? params.yearMonth : undefined;

  const requestsResult = await listLateRelaxationRequests({
    companyId,
    status,
    yearMonth,
  });

  const currentMonth = getCurrentYearMonth();
  const yearMonths = Array.from(
    new Set([
      currentMonth,
      ...requestsResult.data.map((request) => request.yearMonth),
    ]),
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Late relaxations</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review employee requests to waive late fines for a calendar month. Approval zeros fines
          for that month while keeping late marks on attendance.
        </p>
      </div>

      <LateRelaxationManager
        requests={requestsResult.data.map(serializeLateRelaxationRequest)}
        filters={{ status, yearMonth }}
        yearMonths={yearMonths}
      />
    </div>
  );
}
