"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";

type ReportsEmployeeHeaderProps = {
  report: SerializedEmployeeReport;
};

export function ReportsEmployeeHeader({ report }: ReportsEmployeeHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{report.employee.fullName}</CardTitle>
      </CardHeader>
      <CardContent className="-mt-2">
        <p className="text-muted-foreground text-sm">
          {report.employee.employeeCode} · {report.employee.email}
          {report.employee.designation ? ` · ${report.employee.designation}` : ""}
          {report.employee.department ? ` · ${report.employee.department}` : ""}
          {!report.employee.isActive && (
            <span className="ml-2 text-amber-700 dark:text-amber-300">(inactive)</span>
          )}
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          {report.range.from} to {report.range.to} · {report.summary.shiftDaysInRange} shift days in
          range
        </p>
      </CardContent>
    </Card>
  );
}
