import type { EmployeeReport, EmployeeReportRow, SummaryReport } from "./reports-service";

export type SerializedEmployeeReportRow = Omit<
  EmployeeReportRow,
  "checkInAt" | "checkOutAt" | "overtimeStartedAt" | "overtimeEndedAt"
> & {
  checkInAt: string | null;
  checkOutAt: string | null;
  overtimeStartedAt: string | null;
  overtimeEndedAt: string | null;
};

export type SerializedEmployeeReport = Omit<EmployeeReport, "days"> & {
  days: SerializedEmployeeReportRow[];
};

export function serializeEmployeeReport(report: EmployeeReport): SerializedEmployeeReport {
  return {
    ...report,
    days: report.days.map((day) => ({
      ...day,
      checkInAt: day.checkInAt?.toISOString() ?? null,
      checkOutAt: day.checkOutAt?.toISOString() ?? null,
      overtimeStartedAt: day.overtimeStartedAt?.toISOString() ?? null,
      overtimeEndedAt: day.overtimeEndedAt?.toISOString() ?? null,
    })),
  };
}

export function serializeSummaryReport(report: SummaryReport): SummaryReport {
  return report;
}
