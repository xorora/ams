import { Suspense } from "react";
import { ReportsSummaryView } from "@/components/admin/reports-summary-view";
import { requireAdminSession } from "@/lib/auth/require-session";

export default async function AdminReportsPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Attendance totals by shift date (PKT). Drill into an employee for day-by-day detail, or
          download Excel exports that match the on-screen totals.
        </p>
      </div>

      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading report…</p>}>
        <ReportsSummaryView />
      </Suspense>
    </div>
  );
}
