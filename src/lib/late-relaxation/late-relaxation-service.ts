import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { employees, lateRelaxationRequests } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import {
  getEmployeeMonthlyLateSummary,
  MONTHLY_LATE_ALLOWANCE,
} from "@/lib/attendance/late-fines";
import { withLateRelaxationSchema } from "./ensure-schema";
import type { LateRelaxationStatus, SubmitLateRelaxationInput } from "./types";

export type LateRelaxationListItem = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string | null;
  yearMonth: string;
  reason: string;
  lateCountAtRequest: number;
  status: LateRelaxationStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListLateRelaxationFilters = {
  employeeId?: string;
  companyId?: string;
  status?: LateRelaxationStatus;
  yearMonth?: string;
};

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

function mapRow(
  request: typeof lateRelaxationRequests.$inferSelect,
  employee: typeof employees.$inferSelect,
): LateRelaxationListItem {
  return {
    id: request.id,
    employeeId: request.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    employeeDepartment: employee.department,
    yearMonth: request.yearMonth,
    reason: request.reason,
    lateCountAtRequest: request.lateCountAtRequest,
    status: request.status,
    reviewedByUserId: request.reviewedByUserId,
    reviewedAt: request.reviewedAt,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function buildListConditions(filters: ListLateRelaxationFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.employeeId) {
    conditions.push(eq(lateRelaxationRequests.employeeId, filters.employeeId));
  }
  if (filters.companyId) {
    conditions.push(eq(employees.companyId, filters.companyId));
  }
  if (filters.status) {
    conditions.push(eq(lateRelaxationRequests.status, filters.status));
  }
  if (filters.yearMonth) {
    conditions.push(eq(lateRelaxationRequests.yearMonth, filters.yearMonth));
  }
  return conditions;
}

async function loadItem(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<LateRelaxationListItem>> {
  const [row] = await withLateRelaxationSchema(() =>
    db
      .select({ request: lateRelaxationRequests, employee: employees })
      .from(lateRelaxationRequests)
      .innerJoin(employees, eq(lateRelaxationRequests.employeeId, employees.id))
      .where(eq(lateRelaxationRequests.id, id))
      .limit(1),
  );

  if (!row) {
    return adminFailure(404, "NOT_FOUND", "Late relaxation request not found.");
  }

  return { ok: true, data: mapRow(row.request, row.employee) };
}

export function getCurrentYearMonth(): string {
  return formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM");
}

export async function listLateRelaxationRequests(
  filters: ListLateRelaxationFilters = {},
): Promise<ServiceSuccess<LateRelaxationListItem[]>> {
  const conditions = buildListConditions(filters);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await withLateRelaxationSchema(() =>
    db
      .select({ request: lateRelaxationRequests, employee: employees })
      .from(lateRelaxationRequests)
      .innerJoin(employees, eq(lateRelaxationRequests.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(lateRelaxationRequests.createdAt)),
  );

  return {
    ok: true,
    data: rows.map(({ request, employee }) => mapRow(request, employee)),
  };
}

export async function countPendingLateRelaxationRequests(
  companyId?: string | null,
): Promise<number> {
  const conditions = [eq(lateRelaxationRequests.status, "pending")];
  if (companyId) {
    conditions.push(eq(employees.companyId, companyId));
  }

  const [row] = await withLateRelaxationSchema(() =>
    db
      .select({ value: count() })
      .from(lateRelaxationRequests)
      .innerJoin(employees, eq(lateRelaxationRequests.employeeId, employees.id))
      .where(and(...conditions)),
  );

  return row?.value ?? 0;
}

/** Cross-request cache for sidebar badge (invalidated via updateTag on relaxation actions). */
export async function countPendingLateRelaxationRequestsCached(
  companyId?: string | null,
): Promise<number> {
  const key = companyId ?? "all";
  return unstable_cache(
    () => countPendingLateRelaxationRequests(companyId),
    ["pending-late-relaxation-count", key],
    { revalidate: 30, tags: ["pending-late-relaxation"] },
  )();
}

export async function submitLateRelaxationRequest(
  employeeId: string,
  input: SubmitLateRelaxationInput,
): Promise<ServiceFailure | ServiceSuccess<LateRelaxationListItem>> {
  const yearMonth = input.yearMonth.trim();
  const reason = input.reason.trim();

  if (!YEAR_MONTH_PATTERN.test(yearMonth)) {
    return adminFailure(400, "INVALID_MONTH", "Month must be YYYY-MM.");
  }
  if (!reason) {
    return adminFailure(400, "REASON_REQUIRED", "A reason is required.");
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  if (!employee.isActive) {
    return adminFailure(403, "EMPLOYEE_INACTIVE", "Inactive employees cannot request relaxation.");
  }

  const shiftDate = `${yearMonth}-01`;
  const summary = await getEmployeeMonthlyLateSummary(employeeId, shiftDate);
  if (summary.lateCount <= MONTHLY_LATE_ALLOWANCE) {
    return adminFailure(
      400,
      "NOT_ELIGIBLE",
      `You can request a late relaxation only after more than ${MONTHLY_LATE_ALLOWANCE} late check-ins in the month.`,
    );
  }

  const [blocking] = await withLateRelaxationSchema(() =>
    db
      .select({ id: lateRelaxationRequests.id, status: lateRelaxationRequests.status })
      .from(lateRelaxationRequests)
      .where(
        and(
          eq(lateRelaxationRequests.employeeId, employeeId),
          eq(lateRelaxationRequests.yearMonth, yearMonth),
          inArray(lateRelaxationRequests.status, ["pending", "approved"]),
        ),
      )
      .limit(1),
  );

  if (blocking) {
    return adminFailure(
      409,
      "ALREADY_EXISTS",
      blocking.status === "approved"
        ? "An approved relaxation already exists for this month."
        : "A pending relaxation request already exists for this month.",
    );
  }

  const now = new Date();
  const [created] = await withLateRelaxationSchema(() =>
    db
      .insert(lateRelaxationRequests)
      .values({
        employeeId,
        yearMonth,
        reason,
        lateCountAtRequest: summary.lateCount,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning(),
  );

  return { ok: true, data: mapRow(created, employee) };
}

export async function cancelLateRelaxationRequest(
  employeeId: string,
  id: string,
): Promise<ServiceFailure | ServiceSuccess<LateRelaxationListItem>> {
  const current = await loadItem(id);
  if (!current.ok) {
    return current;
  }

  if (current.data.employeeId !== employeeId) {
    return adminFailure(403, "FORBIDDEN", "You can only cancel your own requests.");
  }
  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending requests can be cancelled.");
  }

  const now = new Date();
  const [updated] = await db
    .update(lateRelaxationRequests)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(lateRelaxationRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapRow(updated, employee) };
}

export async function approveLateRelaxationRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<LateRelaxationListItem>> {
  const current = await loadItem(id);
  if (!current.ok) {
    return current;
  }
  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending requests can be approved.");
  }

  const now = new Date();
  const [updated] = await db
    .update(lateRelaxationRequests)
    .set({
      status: "approved",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(lateRelaxationRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapRow(updated, employee) };
}

export async function rejectLateRelaxationRequest(
  adminUserId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<ServiceFailure | ServiceSuccess<LateRelaxationListItem>> {
  const current = await loadItem(id);
  if (!current.ok) {
    return current;
  }
  if (current.data.status !== "pending") {
    return adminFailure(400, "INVALID_STATUS", "Only pending requests can be rejected.");
  }

  const now = new Date();
  const [updated] = await db
    .update(lateRelaxationRequests)
    .set({
      status: "rejected",
      reviewedByUserId: adminUserId,
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(lateRelaxationRequests.id, id))
    .returning();

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, updated.employeeId))
    .limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  return { ok: true, data: mapRow(updated, employee) };
}

export { MONTHLY_LATE_ALLOWANCE };
