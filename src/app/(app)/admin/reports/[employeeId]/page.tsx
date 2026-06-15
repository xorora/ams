import { ReportsEmployeeView } from "@/components/admin/reports-employee-view";
import { serializeEmployeeReport } from "@/lib/admin/reports-serialize";
import { defaultReportDateRange, getEmployeeReport } from "@/lib/admin/reports-service";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function AdminEmployeeReportPage({ params, searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const { employeeId } = await params;
  const query = await searchParams;
  const defaults = defaultReportDateRange();
  const from = query.from ?? defaults.from;
  const to = query.to ?? defaults.to;

  const reportResult = await getEmployeeReport(employeeId, from, to, companyId);
  const report = reportResult.ok ? serializeEmployeeReport(reportResult.data) : null;
  const loadError = reportResult.ok ? null : reportResult.message;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Employee report</h1>
      </div>

      <ReportsEmployeeView
        employeeId={employeeId}
        from={from}
        to={to}
        report={report}
        loadError={loadError}
      />
    </div>
  );
}
