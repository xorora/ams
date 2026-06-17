import { ReportsSummaryView } from "@/components/admin/reports-summary-view";
import { defaultReportDateRange, getSummaryReport } from "@/lib/admin/reports-service";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function AdminReportsPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;
  const defaults = defaultReportDateRange();
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const reportResult = await getSummaryReport(from, to, companyId);
  const report = reportResult.ok ? reportResult.data : null;
  const loadError = reportResult.ok ? null : reportResult.message;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Attendance totals by shift date (PKT). Drill into an employee for day-by-day detail, or
          download Excel exports that match the on-screen totals.
        </p>
      </div>

      <ReportsSummaryView
        className="md:min-h-0 md:flex-1"
        from={from}
        to={to}
        report={report}
        loadError={loadError}
      />
    </div>
  );
}
