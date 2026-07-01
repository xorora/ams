import { notFound } from "next/navigation";
import { SalarySlipDetailManager } from "@/components/accounting/salary-slip-detail-manager";
import { formatYearMonth } from "@/lib/accounting/format";
import { getSalarySlip } from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipDetail } from "@/lib/accounting/serialize";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSalarySlipDetailPage({ params }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const { id } = await params;

  const scope = {
    role: session.user.role as "admin" | "accounting_admin",
    companyId: session.user.role === "accounting_admin" ? companyId : null,
  };

  const result = await getSalarySlip(id, scope);
  if (!result.ok) {
    notFound();
  }

  const slip = serializeSalarySlipDetail(result.data);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">{slip.employeeName}</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {formatYearMonth(slip.yearMonth)} · {slip.companyName}
        </p>
      </div>

      <SalarySlipDetailManager slip={slip} showFullBank />
    </div>
  );
}
