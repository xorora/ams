import { ReportsSummaryView } from "@/components/admin/reports-summary-view";
import { defaultReportDateRange, getSummaryReport } from "@/lib/admin/reports-service";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function AdminReportsPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const params = await searchParams;
  const defaults = defaultReportDateRange();
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const reportResult = await getSummaryReport(from, to);
  const report = reportResult.ok ? reportResult.data : null;
  const loadError = reportResult.ok ? null : reportResult.message;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Attendance totals by shift date (PKT). Drill into an employee for day-by-day detail, or
          download Excel exports that match the on-screen totals.
        </p>
      </div>

      <ReportsSummaryView from={from} to={to} report={report} loadError={loadError} />
    </div>
  );
}
