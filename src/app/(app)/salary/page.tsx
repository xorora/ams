import { EmployeeSalarySlipsTable } from "@/components/salary/employee-salary-slips-table";
import { listEmployeeSalarySlips } from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipListItem } from "@/lib/accounting/serialize";
import { requireEmployeeSession } from "@/lib/auth/require-session";

export default async function SalaryPage() {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const result = await listEmployeeSalarySlips(employeeId);
  const slips = result.data.map(serializeSalarySlipListItem);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Salary slips</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          View your monthly salary slips and download PDF copies.
        </p>
      </div>

      <EmployeeSalarySlipsTable slips={slips} className="md:min-h-0 md:flex-1" />
    </div>
  );
}
