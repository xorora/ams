import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees } from "@/db/schema";
import { overtimeFieldsFromTimes, overtimeFieldsOnCheckout } from "@/lib/attendance/overtime";
import { isEarlyLeave, isLateCheckIn } from "@/lib/attendance/rules";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export type { EmployeeRecord } from "./employees-service";

export type AttendanceStatus = "present" | "absent" | "leave" | "weekend_off";

export type AttendanceListItem = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  shiftDate: string;
  status: AttendanceStatus;
  source: "auto" | "manual" | "system";
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  isMissedCheckout: boolean;
  overtimeStartedAt: Date | null;
  overtimeEndedAt: Date | null;
  overtimeSeconds: number | null;
  totalBreakSeconds: number;
  notes: string | null;
  editedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListAttendanceFilters = {
  from?: string;
  to?: string;
  employeeId?: string;
  companyId?: string;
  status?: AttendanceStatus;
  page?: number;
  limit?: number;
};

export type CreateAttendanceInput = {
  employeeId: string;
  shiftDate: string;
  status?: AttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  notes?: string | null;
};

export type UpdateAttendanceInput = {
  status?: AttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  isLate?: boolean;
  isEarlyLeave?: boolean;
  overtimeStartedAt?: string | null;
  overtimeEndedAt?: string | null;
  overtimeSeconds?: number | null;
  totalBreakSeconds?: number;
  notes?: string | null;
};

export type AttendanceListResult = {
  items: AttendanceListItem[];
  total: number;
  page: number;
  limit: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function validateShiftDate(shiftDate: string): ServiceFailure | ServiceSuccess<string> {
  if (!DATE_PATTERN.test(shiftDate)) {
    return adminFailure(400, "INVALID_SHIFT_DATE", "Shift date must be YYYY-MM-DD.");
  }
  return { ok: true, data: shiftDate };
}

async function getActiveEmployee(
  employeeId: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  return { ok: true, data: employee };
}

function mapAttendanceRow(
  row: typeof attendanceDays.$inferSelect,
  employee: typeof employees.$inferSelect,
): AttendanceListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    shiftDate: row.shiftDate,
    status: row.status,
    source: row.source,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkInLat: row.checkInLat,
    checkInLng: row.checkInLng,
    checkOutLat: row.checkOutLat,
    checkOutLng: row.checkOutLng,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    isMissedCheckout: row.isMissedCheckout,
    overtimeStartedAt: row.overtimeStartedAt,
    overtimeEndedAt: row.overtimeEndedAt,
    overtimeSeconds: row.overtimeSeconds,
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
    editedByUserId: row.editedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadAttendanceItem(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<AttendanceListItem>> {
  const [row] = await db.select().from(attendanceDays).where(eq(attendanceDays.id, id)).limit(1);
  if (!row) {
    return adminFailure(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found.");
  }

  const employeeResult = await getActiveEmployee(row.employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  return { ok: true, data: mapAttendanceRow(row, employeeResult.data) };
}

function buildListConditions(filters: ListAttendanceFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.from) {
    conditions.push(gte(attendanceDays.shiftDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(attendanceDays.shiftDate, filters.to));
  }
  if (filters.employeeId) {
    conditions.push(eq(attendanceDays.employeeId, filters.employeeId));
  }
  if (filters.status) {
    conditions.push(eq(attendanceDays.status, filters.status));
  }
  if (filters.companyId) {
    conditions.push(eq(employees.companyId, filters.companyId));
  }

  return conditions;
}

export async function listAttendance(
  filters: ListAttendanceFilters = {},
): Promise<ServiceSuccess<AttendanceListResult>> {
  const conditions = buildListConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const paginate = filters.page != null || filters.limit != null;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = (page - 1) * limit;

  const baseQuery = db
    .select({
      attendance: attendanceDays,
      employee: employees,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(whereClause)
    .orderBy(desc(attendanceDays.shiftDate), desc(attendanceDays.createdAt));

  const rows = paginate ? await baseQuery.limit(limit).offset(offset) : await baseQuery;

  const total = paginate
    ? (
        await db
          .select({ id: attendanceDays.id })
          .from(attendanceDays)
          .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
          .where(whereClause)
      ).length
    : rows.length;

  return {
    ok: true,
    data: {
      items: rows.map(({ attendance, employee }) => mapAttendanceRow(attendance, employee)),
      total,
      page: paginate ? page : 1,
      limit: paginate ? limit : rows.length,
    },
  };
}

export async function getAttendance(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<AttendanceListItem>> {
  return loadAttendanceItem(id);
}

export async function createAttendance(
  adminUserId: string,
  input: CreateAttendanceInput,
): Promise<ServiceFailure | ServiceSuccess<AttendanceListItem>> {
  const shiftDateResult = validateShiftDate(input.shiftDate);
  if (!shiftDateResult.ok) {
    return shiftDateResult;
  }

  const employeeResult = await getActiveEmployee(input.employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const [existing] = await db
    .select({ id: attendanceDays.id })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, input.employeeId),
        eq(attendanceDays.shiftDate, shiftDateResult.data),
      ),
    )
    .limit(1);

  if (existing) {
    return adminFailure(
      409,
      "DUPLICATE_ATTENDANCE",
      "An attendance record already exists for this employee and shift date.",
    );
  }

  const checkInAt = parseOptionalDate(input.checkInAt);
  const checkOutAt = parseOptionalDate(input.checkOutAt);

  if (input.checkInAt && checkInAt === null) {
    return adminFailure(400, "INVALID_CHECK_IN", "Check-in time is invalid.");
  }
  if (input.checkOutAt && checkOutAt === null) {
    return adminFailure(400, "INVALID_CHECK_OUT", "Check-out time is invalid.");
  }

  if (checkInAt && checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
    return adminFailure(
      400,
      "INVALID_TIME_RANGE",
      "Check-out time cannot be before check-in time.",
    );
  }

  const status = input.status ?? (checkInAt ? "present" : "absent");
  const isLate = checkInAt ? isLateCheckIn(checkInAt, shiftDateResult.data) : false;
  const earlyLeave =
    checkOutAt && checkInAt ? isEarlyLeave(checkOutAt, shiftDateResult.data) : false;
  const overtime = checkOutAt
    ? overtimeFieldsOnCheckout(shiftDateResult.data, checkOutAt, null)
    : null;
  const now = new Date();

  const [created] = await db
    .insert(attendanceDays)
    .values({
      employeeId: input.employeeId,
      shiftDate: shiftDateResult.data,
      status,
      source: "manual",
      checkInAt: checkInAt ?? null,
      checkOutAt: checkOutAt ?? null,
      isLate,
      isEarlyLeave: earlyLeave,
      overtimeStartedAt: overtime?.overtimeStartedAt ?? null,
      overtimeEndedAt: overtime?.overtimeEndedAt ?? null,
      overtimeSeconds: overtime?.overtimeSeconds ?? null,
      notes: input.notes?.trim() || null,
      editedByUserId: adminUserId,
      updatedAt: now,
    })
    .returning();

  return loadAttendanceItem(created.id);
}

export async function updateAttendance(
  id: string,
  adminUserId: string,
  input: UpdateAttendanceInput,
): Promise<ServiceFailure | ServiceSuccess<AttendanceListItem>> {
  const current = await loadAttendanceItem(id);
  if (!current.ok) {
    return current;
  }

  const row = current.data;
  const now = new Date();
  const updates: Partial<typeof attendanceDays.$inferInsert> = {
    source: "manual",
    editedByUserId: adminUserId,
    updatedAt: now,
  };

  if (input.status !== undefined) {
    updates.status = input.status;
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes?.trim() || null;
  }

  if (input.totalBreakSeconds !== undefined) {
    if (input.totalBreakSeconds < 0) {
      return adminFailure(400, "INVALID_BREAK_TOTAL", "Break total cannot be negative.");
    }
    updates.totalBreakSeconds = input.totalBreakSeconds;
  }

  const checkInAt = parseOptionalDate(input.checkInAt);
  const checkOutAt = parseOptionalDate(input.checkOutAt);

  if (input.checkInAt !== undefined) {
    if (input.checkInAt && checkInAt === null) {
      return adminFailure(400, "INVALID_CHECK_IN", "Check-in time is invalid.");
    }
    updates.checkInAt = checkInAt ?? null;
  }

  if (input.checkOutAt !== undefined) {
    if (input.checkOutAt && checkOutAt === null) {
      return adminFailure(400, "INVALID_CHECK_OUT", "Check-out time is invalid.");
    }
    updates.checkOutAt = checkOutAt ?? null;
  }

  const nextCheckIn = input.checkInAt !== undefined ? (checkInAt ?? null) : (row.checkInAt ?? null);
  const nextCheckOut =
    input.checkOutAt !== undefined ? (checkOutAt ?? null) : (row.checkOutAt ?? null);

  if (nextCheckIn && nextCheckOut && nextCheckOut.getTime() < nextCheckIn.getTime()) {
    return adminFailure(
      400,
      "INVALID_TIME_RANGE",
      "Check-out time cannot be before check-in time.",
    );
  }

  if (input.isLate !== undefined) {
    updates.isLate = input.isLate;
  } else if (input.checkInAt !== undefined && nextCheckIn) {
    updates.isLate = isLateCheckIn(nextCheckIn, row.shiftDate);
  }

  if (input.isEarlyLeave !== undefined) {
    updates.isEarlyLeave = input.isEarlyLeave;
  } else if (input.checkOutAt !== undefined && nextCheckOut) {
    updates.isEarlyLeave = isEarlyLeave(nextCheckOut, row.shiftDate);
  }

  const overtimeStartedAt = parseOptionalDate(input.overtimeStartedAt);
  const overtimeEndedAt = parseOptionalDate(input.overtimeEndedAt);

  if (
    input.overtimeStartedAt !== undefined &&
    input.overtimeStartedAt &&
    overtimeStartedAt === null
  ) {
    return adminFailure(400, "INVALID_OVERTIME_START", "Overtime start time is invalid.");
  }
  if (input.overtimeEndedAt !== undefined && input.overtimeEndedAt && overtimeEndedAt === null) {
    return adminFailure(400, "INVALID_OVERTIME_END", "Overtime end time is invalid.");
  }
  if (input.overtimeSeconds != null && input.overtimeSeconds < 0) {
    return adminFailure(400, "INVALID_OVERTIME", "Overtime duration cannot be negative.");
  }

  const autoOvertime = overtimeFieldsFromTimes(row.shiftDate, nextCheckIn, nextCheckOut, {
    overtimeStartedAt: row.overtimeStartedAt,
    overtimeEndedAt: row.overtimeEndedAt,
    overtimeSeconds: row.overtimeSeconds,
  });

  let nextOvertimeStart = autoOvertime.overtimeStartedAt;
  let nextOvertimeEnd = autoOvertime.overtimeEndedAt;
  let nextOvertimeSeconds = autoOvertime.overtimeSeconds;

  if (input.overtimeStartedAt !== undefined) {
    nextOvertimeStart = overtimeStartedAt ?? null;
  }
  if (input.overtimeEndedAt !== undefined) {
    nextOvertimeEnd = overtimeEndedAt ?? null;
  }
  if (input.overtimeSeconds !== undefined) {
    nextOvertimeSeconds = input.overtimeSeconds;
  } else if (
    (input.overtimeStartedAt !== undefined || input.overtimeEndedAt !== undefined) &&
    nextOvertimeStart &&
    nextOvertimeEnd
  ) {
    nextOvertimeSeconds = Math.max(
      0,
      Math.floor((nextOvertimeEnd.getTime() - nextOvertimeStart.getTime()) / 1000),
    );
  }

  updates.overtimeStartedAt = nextOvertimeStart;
  updates.overtimeEndedAt = nextOvertimeEnd;
  updates.overtimeSeconds = nextOvertimeSeconds;

  const [updated] = await db
    .update(attendanceDays)
    .set(updates)
    .where(eq(attendanceDays.id, id))
    .returning();

  if (!updated) {
    return adminFailure(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found.");
  }

  return loadAttendanceItem(updated.id);
}

export async function markAttendanceStatus(
  id: string,
  adminUserId: string,
  status: AttendanceStatus,
): Promise<ServiceFailure | ServiceSuccess<AttendanceListItem>> {
  if (!["present", "absent", "leave"].includes(status)) {
    return adminFailure(400, "INVALID_STATUS", "Status must be present, absent, or leave.");
  }

  const current = await loadAttendanceItem(id);
  if (!current.ok) {
    return current;
  }

  const now = new Date();
  const updates: Partial<typeof attendanceDays.$inferInsert> = {
    status,
    source: "manual",
    editedByUserId: adminUserId,
    updatedAt: now,
  };

  if (status === "absent") {
    updates.checkInAt = null;
    updates.checkOutAt = null;
    updates.checkInLat = null;
    updates.checkInLng = null;
    updates.checkOutLat = null;
    updates.checkOutLng = null;
    updates.isLate = false;
    updates.isEarlyLeave = false;
    updates.isMissedCheckout = false;
    updates.overtimeStartedAt = null;
    updates.overtimeEndedAt = null;
    updates.overtimeSeconds = null;
    updates.totalBreakSeconds = 0;
  }

  const [updated] = await db
    .update(attendanceDays)
    .set(updates)
    .where(eq(attendanceDays.id, id))
    .returning();

  if (!updated) {
    return adminFailure(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found.");
  }

  return loadAttendanceItem(updated.id);
}

export async function deleteAttendance(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<{ id: string }>> {
  const current = await loadAttendanceItem(id);
  if (!current.ok) {
    return current;
  }

  await db.delete(attendanceDays).where(eq(attendanceDays.id, id));
  return { ok: true, data: { id } };
}
