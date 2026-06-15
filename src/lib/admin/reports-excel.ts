import { formatInTimeZone } from "date-fns-tz";
import ExcelJS from "exceljs";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import type { EmployeeReport, SummaryReport } from "./reports-service";

function formatPktDateTime(value: Date | null): string {
  if (!value) {
    return "";
  }
  return formatInTimeZone(value, BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm");
}

function formatBreakSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export async function buildSummaryExcel(report: SummaryReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AMS";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 16 },
  ];
  summarySheet.addRow(["Report period", `${report.range.from} to ${report.range.to}`]);
  summarySheet.addRow(["Timezone", BUSINESS_TIMEZONE]);
  summarySheet.addRow(["Active employees", report.activeEmployeeCount]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Total records", report.totals.records]);
  summarySheet.addRow(["Present", report.totals.present]);
  summarySheet.addRow(["Absent", report.totals.absent]);
  summarySheet.addRow(["Leave", report.totals.leave]);
  summarySheet.addRow(["Late check-ins", report.totals.late]);
  summarySheet.addRow(["Early check-outs", report.totals.earlyLeave]);

  const detailSheet = workbook.addWorksheet("By employee");
  detailSheet.columns = [
    { header: "Employee code", key: "code", width: 14 },
    { header: "Name", key: "name", width: 24 },
    { header: "Designation", key: "designation", width: 18 },
    { header: "Department", key: "department", width: 18 },
    { header: "Active", key: "active", width: 8 },
    { header: "Records", key: "records", width: 10 },
    { header: "Present", key: "present", width: 10 },
    { header: "Absent", key: "absent", width: 10 },
    { header: "Leave", key: "leave", width: 10 },
    { header: "Late", key: "late", width: 8 },
    { header: "Early leave", key: "early", width: 12 },
  ];

  for (const row of report.employees) {
    detailSheet.addRow({
      code: row.employeeCode,
      name: row.fullName,
      designation: row.designation ?? "",
      department: row.department ?? "",
      active: row.isActive ? "Yes" : "No",
      records: row.totals.records,
      present: row.totals.present,
      absent: row.totals.absent,
      leave: row.totals.leave,
      late: row.totals.late,
      early: row.totals.earlyLeave,
    });
  }

  detailSheet.addRow({
    code: "TOTAL",
    name: "",
    designation: "",
    department: "",
    active: "",
    records: report.totals.records,
    present: report.totals.present,
    absent: report.totals.absent,
    leave: report.totals.leave,
    late: report.totals.late,
    early: report.totals.earlyLeave,
  });
  detailSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildEmployeeExcel(report: EmployeeReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AMS";
  workbook.created = new Date();

  const infoSheet = workbook.addWorksheet("Employee");
  infoSheet.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 36 },
  ];
  infoSheet.addRow(["Report period", `${report.range.from} to ${report.range.to}`]);
  infoSheet.addRow(["Timezone", BUSINESS_TIMEZONE]);
  infoSheet.addRow(["Employee code", report.employee.employeeCode]);
  infoSheet.addRow(["Name", report.employee.fullName]);
  infoSheet.addRow(["Email", report.employee.email]);
  infoSheet.addRow(["Designation", report.employee.designation ?? ""]);
  infoSheet.addRow(["Department", report.employee.department ?? ""]);
  infoSheet.addRow(["Active", report.employee.isActive ? "Yes" : "No"]);
  infoSheet.addRow(["Shift days in range", report.summary.shiftDaysInRange]);
  infoSheet.addRow([]);
  infoSheet.addRow(["Records", report.summary.records]);
  infoSheet.addRow(["Present", report.summary.present]);
  infoSheet.addRow(["Absent", report.summary.absent]);
  infoSheet.addRow(["Leave", report.summary.leave]);
  infoSheet.addRow(["Late check-ins", report.summary.late]);
  infoSheet.addRow(["Early check-outs", report.summary.earlyLeave]);

  const daysSheet = workbook.addWorksheet("Attendance");
  daysSheet.columns = [
    { header: "Shift date", key: "shiftDate", width: 12 },
    { header: "Status", key: "status", width: 10 },
    { header: "Source", key: "source", width: 10 },
    { header: "Check-in (PKT)", key: "checkIn", width: 18 },
    { header: "Check-out (PKT)", key: "checkOut", width: 18 },
    { header: "Overtime start (PKT)", key: "overtimeStart", width: 18 },
    { header: "Overtime end (PKT)", key: "overtimeEnd", width: 18 },
    { header: "Overtime elapsed", key: "overtimeElapsed", width: 14 },
    { header: "Late", key: "late", width: 8 },
    { header: "Early leave", key: "early", width: 12 },
    { header: "Break", key: "break", width: 12 },
    { header: "Notes", key: "notes", width: 32 },
  ];

  for (const day of report.days) {
    daysSheet.addRow({
      shiftDate: day.shiftDate,
      status: day.status,
      source: day.source,
      checkIn: formatPktDateTime(day.checkInAt),
      checkOut: formatPktDateTime(day.checkOutAt),
      overtimeStart: formatPktDateTime(day.overtimeStartedAt),
      overtimeEnd: formatPktDateTime(day.overtimeEndedAt),
      overtimeElapsed: day.overtimeSeconds != null ? formatBreakSeconds(day.overtimeSeconds) : "",
      late: day.isLate ? "Yes" : "No",
      early: day.isEarlyLeave ? "Yes" : "No",
      break: formatBreakSeconds(day.totalBreakSeconds),
      notes: day.notes ?? "",
    });
  }

  daysSheet.getRow(1).font = { bold: true };
  infoSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function summaryExportFilename(from: string, to: string): string {
  return `attendance-summary_${from}_${to}.xlsx`;
}

export function employeeExportFilename(employeeCode: string, from: string, to: string): string {
  const safeCode = employeeCode.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `attendance-${safeCode}_${from}_${to}.xlsx`;
}
