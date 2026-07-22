import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CompensationEditor } from "@/components/accounting/compensation-editor";
import { db } from "@/db";
import { salarySlips } from "@/db/schema";
import { getEmployeeInCompany } from "@/lib/accounting/company-access";
import { getCompensation } from "@/lib/accounting/compensation-service";
import { resolvePayrollYearMonth } from "@/lib/accounting/format";
import { serializeCompensation } from "@/lib/accounting/serialize";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ yearMonth?: string }>;
};

export default async function AdminCompensationDetailPage({ params, searchParams }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const { employeeId } = await params;
  const query = await searchParams;
  const yearMonth = resolvePayrollYearMonth(query.yearMonth);

  const employeeResult = await getEmployeeInCompany(employeeId, companyId);
  if (!employeeResult.ok) {
    notFound();
  }

  const employee = employeeResult.data;
  const [compensationResult, [slip]] = await Promise.all([
    getCompensation(employeeId, companyId),
    db
      .select({ incomeTaxPkr: salarySlips.incomeTaxPkr })
      .from(salarySlips)
      .where(and(eq(salarySlips.employeeId, employeeId), eq(salarySlips.yearMonth, yearMonth)))
      .limit(1),
  ]);
  const compensation = compensationResult.ok
    ? serializeCompensation(compensationResult.data)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Compensation profile</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Configure salary structure and monthly income tax used on the compensation sheet.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <CompensationEditor
          employeeId={employee.id}
          employeeName={employee.fullName}
          employeeCode={employee.employeeCode}
          compensation={compensation}
          yearMonth={yearMonth}
          incomeTaxPkr={slip?.incomeTaxPkr ?? 0}
        />
      </div>
    </div>
  );
}
