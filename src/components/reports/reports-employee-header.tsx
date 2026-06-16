"use client";

import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";

type ReportsEmployeeHeaderProps = {
  report: SerializedEmployeeReport;
};

export function ReportsEmployeeHeader({ report }: ReportsEmployeeHeaderProps) {
  const meta = [
    report.employee.email,
    report.employee.designation,
    report.employee.department,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{report.employee.fullName}</h2>
        {meta.length > 0 ? (
          <p className="text-muted-foreground text-sm">{meta.join(" · ")}</p>
        ) : null}
        {!report.employee.isActive ? (
          <p className="text-amber-700 text-sm">Inactive employee</p>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {report.range.from} to {report.range.to} · {report.summary.shiftDaysInRange} shift days in
        range
      </p>
    </div>
  );
}
