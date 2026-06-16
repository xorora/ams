import { EmployeesManager } from "@/components/admin/employees-manager";
import { listEmployees } from "@/lib/admin/employees-service";
import { getTodayPkt } from "@/lib/admin/probation";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeEmployee } from "@/lib/admin/serialize";
import { batchGetEmployeePendingLateFines } from "@/lib/attendance/late-fines";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ search?: string; includeInactive?: string }>;
};

export default async function AdminEmployeesPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;
  const search = params.search ?? "";
  const includeInactive = params.includeInactive === "true";

  const result = await listEmployees({
    includeInactive,
    search: search.trim() || undefined,
    companyId,
  });

  const pendingFines = await batchGetEmployeePendingLateFines(
    result.data.map((employee) => employee.id),
    getTodayPkt(),
  );

  const employees = result.data.map((employee) => {
    const fines = pendingFines.get(employee.id);
    return serializeEmployee(employee, {
      pendingLateFinePkr: fines?.pendingLateFinePkr ?? 0,
      pendingFineableLates: fines?.fineableLates ?? 0,
    });
  });

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-hidden p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage the employee directory. New employees can sign in with Google once their corporate
          email matches a record here.
        </p>
      </div>

      <EmployeesManager employees={employees} search={search} includeInactive={includeInactive} />
    </div>
  );
}
