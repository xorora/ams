import { and, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees, overtimeRequests } from "@/db/schema";
import { formatShiftDuration } from "@/lib/admin/display";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import type { OvertimeSlipPdfData } from "@/lib/attendance/overtime-pdf";
import { ACTIVE_OVERTIME_REQUEST_STATUSES, MIN_OVERTIME_REQUEST_SECONDS } from "./constants";
import type { OvertimeRequestStatus } from "./types";

export type EligibleOvertimeDay = {
  attendanceDayId: string;
  shiftDate: string;
  checkInAt: Date;
  checkOutAt: Date;
  overtimeStartedAt: Date;
  overtimeEndedAt: Date;
  overtimeSeconds: number;
};

export type OvertimeRequestListItem = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  employeeDesignation: string | null;
  attendanceDayId: string;
  shiftDate: string;
  workDescription: string;
  status: OvertimeRequestStatus;
  checkInAt: Date;
  checkOutAt: Date;
  overtimeStartedAt: Date;
  overtimeEndedAt: Date;
  overtimeSeconds: number;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubmitOvertimeRequestInput = {
  attendanceDayId: string;
  workDescription: string;
};

export type ListOvertimeFilters = {
  employeeId?: string;
  companyId?: string;
  status?: OvertimeRequestStatus;
};

type AttendanceOvertimeRow = typeof attendanceDays.$inferSelect;

function isEligibleAttendanceDay(row: AttendanceOvertimeRow): row is AttendanceOvertimeRow & {
  checkInAt: Date;
  checkOutAt: Date;
  overtimeStartedAt: Date;
  overtimeEndedAt: Date;
  overtimeSeconds: number;
} {
  return (
    row.status === "present" &&
    row.checkInAt != null &&
    row.checkOutAt != null &&
    row.overtimeStartedAt != null &&
    row.overtimeEndedAt != null &&
    row.overtimeSeconds != null &&
    row.overtimeSeconds >= MIN_OVERTIME_REQUEST_SECONDS
  );
}

function mapOvertimeRequestRow(
  request: typeof overtimeRequests.$inferSelect,
  employee: typeof employees.$inferSelect,
  attendance: AttendanceOvertimeRow & {
    checkInAt: Date;
    checkOutAt: Date;
    overtimeStartedAt: Date;
    overtimeEndedAt: Date;
    overtimeSeconds: number;
  },
): OvertimeRequestListItem {
  return {
    id: request.id,
    employeeId: request.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    employeeDesignation: employee.designation,
    attendanceDayId: request.attendanceDayId,
    shiftDate: attendance.shiftDate,
    workDescription: request.workDescription,
    status: request.status,
    checkInAt: attendance.checkInAt,
    checkOutAt: attendance.checkOutAt,
    overtimeStartedAt: attendance.overtimeStartedAt,
    overtimeEndedAt: attendance.overtimeEndedAt,
    overtimeSeconds: attendance.overtimeSeconds,
    reviewedByUserId: request.reviewedByUserId,
    reviewedAt: request.reviewedAt,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

async function getEmployeeForOvertime(
  employeeId: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  if (!employee.isActive) {
    return adminFailure(403, "EMPLOYEE_INACTIVE", "Your employee account is inactive.");
  }
  return { ok: true, data: employee };
}

async function loadAttendanceForEmployee(
  employeeId: string,
  attendanceDayId: string,
): Promise<
  ServiceFailure | ServiceSuccess<AttendanceOvertimeRow & { checkInAt: Date; checkOutAt: Date }>
> {
  const [row] = await db
    .select()
    .from(attendanceDays)
    .where(and(eq(attendanceDays.id, attendanceDayId), eq(attendanceDays.employeeId, employeeId)))
    .limit(1);

  if (!row) {
    return adminFailure(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found.");
  }

  if (!row.checkInAt || !row.checkOutAt) {
    return adminFailure(
      400,
      "MISSING_CHECK_TIMES",
      "Check-in and check-out times are required for an overtime request.",
    );
  }

  return { ok: true, data: { ...row, checkInAt: row.checkInAt, checkOutAt: row.checkOutAt } };
}

async function hasActiveOvertimeRequest(attendanceDayId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: overtimeRequests.id })
    .from(overtimeRequests)
    .where(
      and(
        eq(overtimeRequests.attendanceDayId, attendanceDayId),
        inArray(overtimeRequests.status, [...ACTIVE_OVERTIME_REQUEST_STATUSES]),
      ),
    )
    .limit(1);

  return Boolean(existing);
}

function buildListConditions(filters: ListOvertimeFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.employeeId) {
    conditions.push(eq(overtimeRequests.employeeId, filters.employeeId));
  }

  if (filters.status) {
    conditions.push(eq(overtimeRequests.status, filters.status));
  }

  if (filters.companyId) {
    conditions.push(eq(employees.companyId, filters.companyId));
  }

  return conditions;
}

async function loadOvertimeRequestItem(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<OvertimeRequestListItem>> {
  const [row] = await db
    .select({
      request: overtimeRequests,
      employee: employees,
      attendance: attendanceDays,
    })
    .from(overtimeRequests)
    .innerJoin(employees, eq(overtimeRequests.employeeId, employees.id))
    .innerJoin(attendanceDays, eq(overtimeRequests.attendanceDayId, attendanceDays.id))
    .where(eq(overtimeRequests.id, id))
    .limit(1);

  if (!row) {
    return adminFailure(404, "OVERTIME_NOT_FOUND", "Overtime request not found.");
  }

  if (!isEligibleAttendanceDay(row.attendance)) {
    return adminFailure(
      400,
      "INVALID_ATTENDANCE",
      "Linked attendance record is missing required overtime data.",
    );
  }

  return {
    ok: true,
    data: mapOvertimeRequestRow(row.request, row.employee, row.attendance),
  };
}

export async function listEligibleOvertimeDays(
  employeeId: string,
): Promise<ServiceSuccess<EligibleOvertimeDay[]>> {
  const rows = await db
    .select({ attendance: attendanceDays })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        eq(attendanceDays.status, "present"),
        gte(attendanceDays.overtimeSeconds, MIN_OVERTIME_REQUEST_SECONDS),
      ),
    )
    .orderBy(desc(attendanceDays.shiftDate));

  const eligible: EligibleOvertimeDay[] = [];

  for (const { attendance } of rows) {
    if (!isEligibleAttendanceDay(attendance)) {
      continue;
    }

    const blocked = await hasActiveOvertimeRequest(attendance.id);
    if (blocked) {
      continue;
    }

    eligible.push({
      attendanceDayId: attendance.id,
      shiftDate: attendance.shiftDate,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      overtimeStartedAt: attendance.overtimeStartedAt,
      overtimeEndedAt: attendance.overtimeEndedAt,
      overtimeSeconds: attendance.overtimeSeconds,
    });
  }

  return { ok: true, data: eligible };
}

export async function listOvertimeRequests(
  filters: ListOvertimeFilters = {},
): Promise<ServiceSuccess<OvertimeRequestListItem[]>> {
  const conditions = buildListConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      request: overtimeRequests,
      employee: employees,
      attendance: attendanceDays,
    })
    .from(overtimeRequests)
    .innerJoin(employees, eq(overtimeRequests.employeeId, employees.id))
    .innerJoin(attendanceDays, eq(overtimeRequests.attendanceDayId, attendanceDays.id))
    .where(whereClause)
    .orderBy(desc(overtimeRequests.createdAt));

  const items: OvertimeRequestListItem[] = [];
  for (const row of rows) {
    if (!isEligibleAttendanceDay(row.attendance)) {
      continue;
    }
    items.push(mapOvertimeRequestRow(row.request, row.employee, row.attendance));
  }

  return { ok: true, data: items };
}

export async function submitOvertimeRequest(
  employeeId: string,
  input: SubmitOvertimeRequestInput,
): Promise<ServiceFailure | ServiceSuccess<OvertimeRequestListItem>> {
  const workDescription = input.workDescription.trim();
  if (!workDescription) {
    return adminFailure(400, "MISSING_WORK_DESCRIPTION", "Work description is required.");
  }

  const employeeResult = await getEmployeeForOvertime(employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const attendanceResult = await loadAttendanceForEmployee(employeeId, input.attendanceDayId);
  if (!attendanceResult.ok) {
    return attendanceResult;
  }

  const attendance = attendanceResult.data;
  if (!isEligibleAttendanceDay(attendance)) {
    return adminFailure(
      400,
      "INELIGIBLE_OVERTIME",
      `Overtime must be at least ${formatShiftDuration(MIN_OVERTIME_REQUEST_SECONDS)} to apply.`,
    );
  }

  if (await hasActiveOvertimeRequest(attendance.id)) {
    return adminFailure(
      409,
      "REQUEST_EXISTS",
      "An overtime request already exists for this shift.",
    );
  }

  const now = new Date();
  const [created] = await db
    .insert(overtimeRequests)
    .values({
      employeeId,
      attendanceDayId: attendance.id,
      workDescription,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ok: true,
    data: mapOvertimeRequestRow(created, employeeResult.data, attendance),
  };
}

export async function cancelOvertimeRequest(
  employeeId: string,
  id: string,
): Promise<ServiceFailure | ServiceSuccess<OvertimeRequestListItem>> {
  const current = await loadOvertimeRequestItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.employeeId !== employeeId) {
    return adminFailure(403, "FORBIDDEN", "You can only cancel your own overtime requests.");
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending overtime requests can be cancelled.");
  }

  const now = new Date();
  const [updated] = await db
    .update(overtimeRequests)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(overtimeRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);
  const [attendance] = await db
    .select()
    .from(attendanceDays)
    .where(eq(attendanceDays.id, updated.attendanceDayId))
    .limit(1);

  if (!employee || !attendance || !isEligibleAttendanceDay(attendance)) {
    return adminFailure(404, "RECORD_NOT_FOUND", "Overtime request data could not be loaded.");
  }

  return { ok: true, data: mapOvertimeRequestRow(updated, employee, attendance) };
}

export async function approveOvertimeRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<OvertimeRequestListItem>> {
  const current = await loadOvertimeRequestItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending overtime requests can be approved.");
  }

  const now = new Date();
  const [updated] = await db
    .update(overtimeRequests)
    .set({
      status: "approved",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(overtimeRequests.id, id))
    .returning();

  const reload = await loadOvertimeRequestItem(updated.id);
  return reload.ok ? reload : current;
}

export async function rejectOvertimeRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<OvertimeRequestListItem>> {
  const current = await loadOvertimeRequestItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending overtime requests can be rejected.");
  }

  const now = new Date();
  await db
    .update(overtimeRequests)
    .set({
      status: "rejected",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(overtimeRequests.id, id));

  const reload = await loadOvertimeRequestItem(id);
  return reload.ok ? reload : current;
}

export async function getOvertimeRequestForPdf(
  id: string,
  companyId?: string,
): Promise<ServiceFailure | ServiceSuccess<OvertimeSlipPdfData>> {
  const current = await loadOvertimeRequestItem(id);
  if (!current.ok) {
    return current;
  }

  const item = current.data;

  const [employee] = await db
    .select({
      companyId: employees.companyId,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      designation: employees.designation,
    })
    .from(employees)
    .where(eq(employees.id, item.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  if (companyId && employee.companyId !== companyId) {
    return adminFailure(403, "FORBIDDEN", "Overtime request is not in the selected company.");
  }

  return {
    ok: true,
    data: {
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      shiftDate: item.shiftDate,
      checkInAt: item.checkInAt,
      checkOutAt: item.checkOutAt,
      overtimeStartedAt: item.overtimeStartedAt,
      overtimeEndedAt: item.overtimeEndedAt,
      overtimeSeconds: item.overtimeSeconds,
      workDescription: item.workDescription,
    },
  };
}
