import { OvertimeManager } from "@/components/overtime/overtime-manager";
import { listEmployees } from "@/lib/admin/employees-service";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeEmployee } from "@/lib/admin/serialize";
import { requireAdminSession } from "@/lib/auth/require-session";
import { listOvertimeRequests } from "@/lib/overtime/overtime-request-service";
import { serializeOvertimeRequest } from "@/lib/overtime/serialize";
import type { OvertimeRequestStatus } from "@/lib/overtime/types";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    employeeId?: string;
  }>;
};

export default async function AdminOvertimePage({ searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;

  const statusParam = params.status;
  const filters = {
    status:
      statusParam === "pending" ||
      statusParam === "approved" ||
      statusParam === "rejected" ||
      statusParam === "cancelled"
        ? (statusParam as OvertimeRequestStatus)
        : undefined,
    employeeId: params.employeeId || undefined,
  };

  const [employeesResult, requestsResult] = await Promise.all([
    listEmployees({ includeInactive: false, companyId }),
    listOvertimeRequests({ ...filters, companyId }),
  ]);

  const employees = employeesResult.data.map((employee) => serializeEmployee(employee));
  const requests = requestsResult.data.map(serializeOvertimeRequest);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Overtime requests</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review employee overtime applications and download overtime slips.
        </p>
      </div>

      <OvertimeManager employees={employees} requests={requests} filters={filters} />
    </div>
  );
}
