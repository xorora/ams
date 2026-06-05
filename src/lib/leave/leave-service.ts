import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees, leaveRequests } from "@/db/schema";
import { isCurrentlyOnProbation } from "@/lib/admin/probation";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { LEAVE_ENTITLEMENTS } from "./constants";
import type { LeaveBalance, LeaveRequestStatus, LeaveType } from "./types";
import { countCalendarDays, countWorkingDays, eachDateInRange } from "./working-days";

export type LeaveListItem = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  medicalCertificateNote: string | null;
  status: LeaveRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubmitLeaveInput = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  medicalCertificateNote?: string | null;
};

export type ListLeaveFilters = {
  employeeId?: string;
  status?: LeaveRequestStatus;
  leaveType?: LeaveType;
  year?: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getCurrentYear(): number {
  return Number.parseInt(formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy"), 10);
}

function validateDateRange(
  startDate: string,
  endDate: string,
): ServiceFailure | ServiceSuccess<{ startDate: string; endDate: string }> {
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return adminFailure(400, "INVALID_DATE", "Dates must be YYYY-MM-DD.");
  }
  if (endDate < startDate) {
    return adminFailure(400, "INVALID_DATE_RANGE", "End date cannot be before start date.");
  }
  return { ok: true, data: { startDate, endDate } };
}

function countLeaveDays(leaveType: LeaveType, startDate: string, endDate: string): number {
  const config = LEAVE_ENTITLEMENTS[leaveType];
  return config.workingDaysOnly
    ? countWorkingDays(startDate, endDate)
    : countCalendarDays(startDate, endDate);
}

function getLeaveDatesForAttendance(
  leaveType: LeaveType,
  startDate: string,
  endDate: string,
): string[] {
  const config = LEAVE_ENTITLEMENTS[leaveType];
  const allDates = eachDateInRange(startDate, endDate);

  if (!config.workingDaysOnly) {
    return allDates;
  }

  return allDates.filter((date) => {
    const parsed = new Date(`${date}T12:00:00`);
    const day = parsed.getDay();
    return day !== 0 && day !== 6;
  });
}

function mapLeaveRow(
  row: typeof leaveRequests.$inferSelect,
  employee: typeof employees.$inferSelect,
): LeaveListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    daysCount: row.daysCount,
    reason: row.reason,
    medicalCertificateNote: row.medicalCertificateNote,
    status: row.status,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getEmployeeForLeave(
  employeeId: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  if (!employee.isActive) {
    return adminFailure(403, "EMPLOYEE_INACTIVE", "Your employee account is inactive.");
  }
  if (isCurrentlyOnProbation(employee)) {
    return adminFailure(
      403,
      "PROBATION_ACTIVE",
      "Leave applications are available after probation is completed.",
    );
  }
  return { ok: true, data: employee };
}

async function loadLeaveItem(id: string): Promise<ServiceFailure | ServiceSuccess<LeaveListItem>> {
  const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  if (!row) {
    return adminFailure(404, "LEAVE_NOT_FOUND", "Leave request not found.");
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, row.employeeId))
    .limit(1);
  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapLeaveRow(row, employee) };
}

function buildListConditions(filters: ListLeaveFilters): SQL[] {
  const conditions: SQL[] = [];
  const year = filters.year ?? getCurrentYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  conditions.push(gte(leaveRequests.startDate, yearStart));
  conditions.push(lte(leaveRequests.startDate, yearEnd));

  if (filters.employeeId) {
    conditions.push(eq(leaveRequests.employeeId, filters.employeeId));
  }
  if (filters.status) {
    conditions.push(eq(leaveRequests.status, filters.status));
  }
  if (filters.leaveType) {
    conditions.push(eq(leaveRequests.leaveType, filters.leaveType));
  }

  return conditions;
}

export async function listLeaveRequests(
  filters: ListLeaveFilters = {},
): Promise<ServiceSuccess<LeaveListItem[]>> {
  const conditions = buildListConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ request: leaveRequests, employee: employees })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(whereClause)
    .orderBy(desc(leaveRequests.createdAt));

  return {
    ok: true,
    data: rows.map(({ request, employee }) => mapLeaveRow(request, employee)),
  };
}

export async function getLeaveBalances(
  employeeId: string,
  year = getCurrentYear(),
): Promise<ServiceFailure | ServiceSuccess<LeaveBalance[]>> {
  const employeeResult = await getEmployeeForLeave(employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const requestsResult = await listLeaveRequests({ employeeId, year });
  const requests = requestsResult.data;

  const balances: LeaveBalance[] = (["annual", "casual", "sick"] as LeaveType[]).map(
    (leaveType) => {
      const entitled = LEAVE_ENTITLEMENTS[leaveType].annualDays;
      const relevant = requests.filter((request) => request.leaveType === leaveType);

      const used = relevant
        .filter((request) => request.status === "approved")
        .reduce((sum, request) => sum + request.daysCount, 0);

      const pending = relevant
        .filter((request) => request.status === "pending")
        .reduce((sum, request) => sum + request.daysCount, 0);

      return {
        leaveType,
        entitled,
        used,
        pending,
        remaining: Math.max(0, entitled - used - pending),
      };
    },
  );

  return { ok: true, data: balances };
}

async function validateLeaveSubmission(
  employeeId: string,
  input: SubmitLeaveInput,
): Promise<ServiceFailure | ServiceSuccess<{ daysCount: number }>> {
  const employeeResult = await getEmployeeForLeave(employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const dateResult = validateDateRange(input.startDate, input.endDate);
  if (!dateResult.ok) {
    return dateResult;
  }

  const reason = input.reason.trim();
  if (!reason) {
    return adminFailure(400, "REASON_REQUIRED", "Please provide a reason for your leave request.");
  }

  const config = LEAVE_ENTITLEMENTS[input.leaveType];
  if (config.requiresMedicalCertificate) {
    const note = input.medicalCertificateNote?.trim();
    if (!note) {
      return adminFailure(
        400,
        "MEDICAL_CERTIFICATE_REQUIRED",
        "Sick leave requires a medical certificate reference or note.",
      );
    }
  }

  const daysCount = countLeaveDays(input.leaveType, input.startDate, input.endDate);
  if (daysCount === 0) {
    return adminFailure(
      400,
      "NO_LEAVE_DAYS",
      input.leaveType === "annual"
        ? "The selected range contains no working days."
        : "The selected date range is invalid.",
    );
  }

  const balancesResult = await getLeaveBalances(employeeId);
  if (!balancesResult.ok) {
    return balancesResult;
  }

  const balance = balancesResult.data.find((item) => item.leaveType === input.leaveType);
  if (!balance || daysCount > balance.remaining) {
    return adminFailure(
      400,
      "INSUFFICIENT_BALANCE",
      `Insufficient ${input.leaveType} leave balance. Requested ${daysCount} day(s), ${balance?.remaining ?? 0} remaining.`,
    );
  }

  const overlapResult = await listLeaveRequests({ employeeId });
  const hasOverlap = overlapResult.data.some(
    (request) =>
      (request.status === "pending" || request.status === "approved") &&
      input.startDate <= request.endDate &&
      input.endDate >= request.startDate,
  );
  if (hasOverlap) {
    return adminFailure(
      409,
      "OVERLAPPING_LEAVE",
      "You already have a pending or approved leave request overlapping these dates.",
    );
  }

  return { ok: true, data: { daysCount } };
}

async function syncApprovedLeaveToAttendance(
  request: LeaveListItem,
  editedByUserId: string | null,
): Promise<void> {
  const shiftDates = getLeaveDatesForAttendance(
    request.leaveType,
    request.startDate,
    request.endDate,
  );
  const now = new Date();

  for (const shiftDate of shiftDates) {
    const [existing] = await db
      .select()
      .from(attendanceDays)
      .where(
        and(
          eq(attendanceDays.employeeId, request.employeeId),
          eq(attendanceDays.shiftDate, shiftDate),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(attendanceDays)
        .set({
          status: "leave",
          source: "manual",
          editedByUserId,
          notes: `Leave: ${request.leaveType} (${request.id})`,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, existing.id));
    } else {
      await db.insert(attendanceDays).values({
        employeeId: request.employeeId,
        shiftDate,
        status: "leave",
        source: "manual",
        editedByUserId,
        notes: `Leave: ${request.leaveType} (${request.id})`,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function submitLeaveRequest(
  employeeId: string,
  input: SubmitLeaveInput,
): Promise<ServiceFailure | ServiceSuccess<LeaveListItem>> {
  const validation = await validateLeaveSubmission(employeeId, input);
  if (!validation.ok) {
    return validation;
  }

  const employeeResult = await getEmployeeForLeave(employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const config = LEAVE_ENTITLEMENTS[input.leaveType];
  const initialStatus: LeaveRequestStatus = config.requiresApproval ? "pending" : "approved";
  const now = new Date();

  const [created] = await db
    .insert(leaveRequests)
    .values({
      employeeId,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      daysCount: validation.data.daysCount,
      reason: input.reason.trim(),
      medicalCertificateNote: input.medicalCertificateNote?.trim() || null,
      status: initialStatus,
      reviewedAt: initialStatus === "approved" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const item = mapLeaveRow(created, employeeResult.data);

  if (initialStatus === "approved") {
    await syncApprovedLeaveToAttendance(item, employeeResult.data.userId);
  }

  return { ok: true, data: item };
}

export async function cancelLeaveRequest(
  employeeId: string,
  id: string,
): Promise<ServiceFailure | ServiceSuccess<LeaveListItem>> {
  const current = await loadLeaveItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.employeeId !== employeeId) {
    return adminFailure(403, "FORBIDDEN", "You can only cancel your own leave requests.");
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending leave requests can be cancelled.");
  }

  const now = new Date();
  const [updated] = await db
    .update(leaveRequests)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(leaveRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapLeaveRow(updated, employee) };
}

export async function approveLeaveRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<LeaveListItem>> {
  const current = await loadLeaveItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending leave requests can be approved.");
  }

  const balancesResult = await getLeaveBalances(current.data.employeeId);
  if (!balancesResult.ok) {
    return balancesResult;
  }

  const balance = balancesResult.data.find((item) => item.leaveType === current.data.leaveType);
  if (!balance || current.data.daysCount > balance.remaining) {
    return adminFailure(
      400,
      "INSUFFICIENT_BALANCE",
      "Employee no longer has sufficient leave balance for this request.",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: "approved",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(leaveRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const item = mapLeaveRow(updated, employee);
  await syncApprovedLeaveToAttendance(item, adminUserId);

  return { ok: true, data: item };
}

export async function rejectLeaveRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<LeaveListItem>> {
  const current = await loadLeaveItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending leave requests can be rejected.");
  }

  const now = new Date();
  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: "rejected",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(leaveRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapLeaveRow(updated, employee) };
}
