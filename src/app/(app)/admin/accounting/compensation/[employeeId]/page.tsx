import { notFound } from "next/navigation";
import { CompensationEditor } from "@/components/accounting/compensation-editor";
import { getEmployeeInCompany } from "@/lib/accounting/company-access";
import { getCompensation } from "@/lib/accounting/compensation-service";
import { serializeCompensation } from "@/lib/accounting/serialize";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ employeeId: string }>;
};

export default async function AdminCompensationDetailPage({ params }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const { employeeId } = await params;

  const employeeResult = await getEmployeeInCompany(employeeId, companyId);
  if (!employeeResult.ok) {
    notFound();
  }

  const employee = employeeResult.data;
  const compensationResult = await getCompensation(employeeId, companyId);
  const compensation = compensationResult.ok
    ? serializeCompensation(compensationResult.data)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Compensation profile</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Configure salary and bank details used when generating monthly slips.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <CompensationEditor
          employeeId={employee.id}
          employeeName={employee.fullName}
          employeeCode={employee.employeeCode}
          compensation={compensation}
        />
      </div>
    </div>
  );
}
