import { formatInTimeZone } from "date-fns-tz";
import { LeaveManager } from "@/components/leave/leave-manager";
import { listEmployeeOptions } from "@/lib/admin/employees-service";
import { getCompanies, requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { requireAdminSession } from "@/lib/auth/require-session";
import { listLeaveRequests } from "@/lib/leave/leave-service";
import { serializeLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveRequestStatus, LeaveType } from "@/lib/leave/types";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    leaveType?: string;
    employeeId?: string;
    year?: string;
  }>;
};

export default async function AdminLeavePage({ searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;

  const statusParam = params.status;
  const leaveTypeParam = params.leaveType;
  const currentYear = Number.parseInt(
    formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy"),
    10,
  );
  const yearParam = Number.parseInt(params.year ?? "", 10);
  const year = Number.isFinite(yearParam) && yearParam >= 2000 ? yearParam : currentYear;

  const filters = {
    status:
      statusParam === "pending" ||
      statusParam === "approved" ||
      statusParam === "rejected" ||
      statusParam === "cancelled"
        ? (statusParam as LeaveRequestStatus)
        : undefined,
    leaveType:
      leaveTypeParam === "annual" ||
      leaveTypeParam === "casual" ||
      leaveTypeParam === "sick" ||
      leaveTypeParam === "unpaid"
        ? (leaveTypeParam as LeaveType)
        : undefined,
    employeeId: params.employeeId || undefined,
  };

  const [employeesResult, requestsResult, activeCompanies] = await Promise.all([
    listEmployeeOptions({ includeInactive: false, companyId }),
    listLeaveRequests({ ...filters, companyId, year }),
    getCompanies(),
  ]);

  const employees = employeesResult.data;
  const requests = requestsResult.data.map(serializeLeaveRequest);
  const companyName =
    activeCompanies.find((company) => company.id === companyId)?.name ?? "Company";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Leave requests</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review leave requests for {year}. Open a request to see that employee&apos;s balance for the
          year.
        </p>
      </div>

      <LeaveManager
        employees={employees}
        requests={requests}
        filters={filters}
        companyName={companyName}
      />
    </div>
  );
}
