import { notFound } from "next/navigation";
import { EmployeeSalarySlipDetail } from "@/components/salary/employee-salary-slip-detail";
import { formatYearMonth } from "@/lib/accounting/format";
import { getEmployeeSalarySlip } from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipDetail } from "@/lib/accounting/serialize";
import { requireEmployeeSession } from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalarySlipDetailPage({ params }: PageProps) {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const { id } = await params;
  const result = await getEmployeeSalarySlip(id, employeeId);
  if (!result.ok) {
    notFound();
  }

  const slip = serializeSalarySlipDetail(result.data);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">{formatYearMonth(slip.yearMonth)}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{slip.companyName}</p>
      </div>

      <EmployeeSalarySlipDetail slip={slip} />
    </div>
  );
}
