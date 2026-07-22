import { SalarySlipsManager } from "@/components/accounting/salary-slips-manager";
import { maybeReassignJuly2026SalaryToJuneOnce } from "@/lib/accounting/actions";
import { listCompensationProfiles } from "@/lib/accounting/compensation-service";
import { resolvePayrollYearMonth } from "@/lib/accounting/format";
import { listSalarySlips } from "@/lib/accounting/salary-slip-service";
import {
  serializeCompensationListItem,
  serializeSalarySlipListItem,
} from "@/lib/accounting/serialize";
import { getCompanies } from "@/lib/admin/selected-company";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ yearMonth?: string; employeeId?: string }>;
};

export default async function AdminSalarySlipsPage({ searchParams }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const params = await searchParams;

  await maybeReassignJuly2026SalaryToJuneOnce();

  const yearMonth = resolvePayrollYearMonth(params.yearMonth);
  const employeeId = params.employeeId || undefined;

  const [slipsResult, employeesResult, companies] = await Promise.all([
    listSalarySlips({ companyId, yearMonth, employeeId }),
    listCompensationProfiles({ companyId }),
    getCompanies(),
  ]);

  const slips = slipsResult.data.map(serializeSalarySlipListItem);
  const employees = employeesResult.data.map(serializeCompensationListItem);
  const companyName = companies.find((company) => company.id === companyId)?.name ?? "Company";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Salary slips</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Create and manage monthly salary slips for {companyName}. Attendance snapshots are saved
          when each slip is created or updated.
        </p>
      </div>

      <SalarySlipsManager
        slips={slips}
        employees={employees}
        yearMonth={yearMonth}
        employeeId={employeeId}
        companyName={companyName}
      />
    </div>
  );
}
