import { EmployeeAttendanceHistory } from "@/components/attendance/employee-attendance-history";
import { serializeEmployeeReport } from "@/lib/admin/reports-serialize";
import { defaultReportDateRange, getEmployeeReport } from "@/lib/admin/reports-service";
import { requireEmployeeSession } from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function AttendanceHistoryPage({ searchParams }: PageProps) {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const query = await searchParams;
  const defaults = defaultReportDateRange();
  const from = query.from ?? defaults.from;
  const to = query.to ?? defaults.to;

  const reportResult = await getEmployeeReport(employeeId, from, to);
  const report = reportResult.ok ? serializeEmployeeReport(reportResult.data) : null;
  const loadError = reportResult.ok ? null : reportResult.message;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Attendance history</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review your past shifts, check-in times, late fines, and attendance status.
        </p>
      </div>

      <EmployeeAttendanceHistory
        className="md:min-h-0 md:flex-1"
        from={from}
        to={to}
        report={report}
        loadError={loadError}
      />
    </div>
  );
}
