import { and, asc, eq, ilike, or } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";
import {
  dedupeEmployeeRecords,
  findEmployeeByCodeVariants,
} from "@/lib/admin/employee-identity";
import {
  DEFAULT_PROBATION_PERIOD_MONTHS,
  defaultProbationValues,
  getTodayPkt,
} from "@/lib/admin/probation";
import { type EmployeeShiftPreset } from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { closeOpenShiftForEmployee, findOpenShift } from "@/lib/attendance/close-open-shift";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import { pushEmployeeToDevice } from "@/lib/device-sync/push-employee";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export type EmployeeRecord = typeof employees.$inferSelect;

/** Lean row for attendance/leave dropdowns (avoids selecting full employee rows). */
export type EmployeeOption = {
  id: string;
  employeeCode: string;
  fullName: string;
  isActive: boolean;
};

export type CreateEmployeeInput = {
  employeeCode: string;
  fullName: string;
  email: string;
  companyId?: string;
  department?: string | null;
  designation?: string | null;
  probationEnabled?: boolean;
  probationCompleted?: boolean;
  probationStartDate?: string | null;
  probationPeriodMonths?: number;
  /** Xorora: afternoon/evening. Crest LED: day/evening. */
  shiftPreset?: EmployeeShiftPreset | null;
  /** Optional password for email sign-in; stored on the linked user account. */
  password?: string | null;
};

type ValidatedCreateEmployeeInput = Omit<CreateEmployeeInput, "companyId" | "password"> & {
  companyId: string;
  department: string | null;
  designation: string | null;
};

export type UpdateEmployeeInput = {
  employeeCode?: string;
  fullName?: string;
  email?: string;
  department?: string | null;
  designation?: string | null;
  isActive?: boolean;
  probationEnabled?: boolean;
  probationCompleted?: boolean;
  probationStartDate?: string | null;
  probationPeriodMonths?: number;
  /** Xorora: afternoon/evening. Crest LED: day/evening. */
  shiftPreset?: EmployeeShiftPreset | null;
  /** When set (non-empty), creates or updates the linked user's password. */
  password?: string | null;
};

export type ListEmployeesFilters = {
  includeInactive?: boolean;
  search?: string;
  companyId?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_PROBATION_MONTHS = 1;
const MAX_PROBATION_MONTHS = 24;

function validateProbationPeriodMonths(months: number): ServiceFailure | ServiceSuccess<number> {
  if (!Number.isInteger(months) || months < MIN_PROBATION_MONTHS || months > MAX_PROBATION_MONTHS) {
    return adminFailure(
      400,
      "INVALID_PROBATION_PERIOD",
      `Probation period must be between ${MIN_PROBATION_MONTHS} and ${MAX_PROBATION_MONTHS} months.`,
    );
  }
  return { ok: true, data: months };
}

function validateProbationStartDate(
  startDate: string | null | undefined,
  probationEnabled: boolean,
): ServiceFailure | ServiceSuccess<string | null> {
  if (!probationEnabled) {
    return { ok: true, data: null };
  }

  const value = startDate?.trim() || getTodayPkt();
  if (!DATE_PATTERN.test(value)) {
    return adminFailure(400, "INVALID_PROBATION_START", "Probation start date must be YYYY-MM-DD.");
  }

  return { ok: true, data: value };
}

function resolveCreateProbation(input: CreateEmployeeInput):
  | ServiceFailure
  | ServiceSuccess<{
      probationEnabled: boolean;
      probationCompleted: boolean;
      probationStartDate: string | null;
      probationPeriodMonths: number;
    }> {
  if (input.probationCompleted) {
    return {
      ok: true,
      data: {
        probationEnabled: false,
        probationCompleted: true,
        probationStartDate: null,
        probationPeriodMonths: DEFAULT_PROBATION_PERIOD_MONTHS,
      },
    };
  }

  const probationEnabled = input.probationEnabled ?? false;
  const startValidated = validateProbationStartDate(input.probationStartDate, probationEnabled);
  if (!startValidated.ok) {
    return startValidated;
  }

  const months = input.probationPeriodMonths ?? DEFAULT_PROBATION_PERIOD_MONTHS;
  const monthsValidated = validateProbationPeriodMonths(months);
  if (!monthsValidated.ok) {
    return monthsValidated;
  }

  return {
    ok: true,
    data: {
      probationEnabled,
      probationCompleted: false,
      probationStartDate: startValidated.data,
      probationPeriodMonths: monthsValidated.data,
    },
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmployeeInput(
  input: CreateEmployeeInput,
): ServiceFailure | ServiceSuccess<ValidatedCreateEmployeeInput> {
  const employeeCode = input.employeeCode.trim();
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);

  if (!employeeCode) {
    return adminFailure(400, "INVALID_EMPLOYEE_CODE", "Employee code is required.");
  }
  if (!fullName) {
    return adminFailure(400, "INVALID_NAME", "Full name is required.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    return adminFailure(400, "INVALID_EMAIL", "A valid email address is required.");
  }
  const companyId = input.companyId?.trim();
  if (!companyId) {
    return adminFailure(400, "INVALID_COMPANY", "Company is required.");
  }

  return {
    ok: true,
    data: {
      employeeCode,
      fullName,
      email,
      companyId,
      department: input.department?.trim() || null,
      designation: input.designation?.trim() || null,
    },
  };
}

async function resolveCompanySlug(companyId: string): Promise<string | null> {
  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return company?.slug ?? null;
}

function resolveShiftPresetForCompany(
  companySlug: string | null,
  shiftPreset: string | null | undefined,
): ServiceFailure | ServiceSuccess<EmployeeShiftPreset | null> {
  if (companySlug === "xorora") {
    if (shiftPreset == null || shiftPreset === "") {
      return { ok: true, data: "afternoon" };
    }
    if (shiftPreset !== "afternoon" && shiftPreset !== "evening") {
      return adminFailure(
        400,
        "INVALID_SHIFT_PRESET",
        "Xorora shift must be afternoon (3pm–12am) or evening (6pm–3am).",
      );
    }
    return { ok: true, data: shiftPreset };
  }

  if (companySlug === "crest-led") {
    if (shiftPreset == null || shiftPreset === "") {
      return { ok: true, data: "day" };
    }
    if (shiftPreset !== "day" && shiftPreset !== "evening") {
      return adminFailure(
        400,
        "INVALID_SHIFT_PRESET",
        "Crest LED shift must be day (9am–5pm) or evening (6pm–3am).",
      );
    }
    return { ok: true, data: shiftPreset };
  }

  return { ok: true, data: null };
}

async function linkEmployeeToUserByEmail(employeeId: string, email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return;
  }

  await db
    .update(employees)
    .set({ userId: user.id, updatedAt: new Date() })
    .where(eq(employees.id, employeeId));

  if (!user.employeeId) {
    await db.update(users).set({ employeeId, updatedAt: new Date() }).where(eq(users.id, user.id));
  }
}

/**
 * Ensure a user account exists for the employee and set/reset their passwordHash.
 */
export async function setEmployeePassword(
  employeeId: string,
  password: string,
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const passwordError = validatePassword(password);
  if (passwordError) {
    return adminFailure(400, "INVALID_PASSWORD", passwordError);
  }

  const current = await getEmployee(employeeId);
  if (!current.ok) {
    return current;
  }

  const employee = current.data;
  const email = normalizeEmail(employee.email);
  const passwordHash = await hashPassword(password);
  const now = new Date();

  if (employee.userId) {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, employee.userId));

    return { ok: true, data: employee };
  }

  const [userByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (userByEmail) {
    if (userByEmail.employeeId && userByEmail.employeeId !== employee.id) {
      return adminFailure(
        409,
        "USER_ALREADY_LINKED",
        "A user with this email is already linked to a different employee.",
      );
    }

    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userByEmail.id));

    await linkUserToEmployeeRecord(userByEmail.id, employee.id);

    const [reloaded] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
    return { ok: true, data: reloaded ?? employee };
  }

  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      name: employee.fullName,
      passwordHash,
      role: "employee",
    })
    .returning();

  await linkUserToEmployeeRecord(createdUser.id, employee.id);

  const [reloaded] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
  return { ok: true, data: reloaded ?? employee };
}

async function unlinkEmployeeUser(employeeId: string, userId: string | null): Promise<void> {
  if (!userId) {
    return;
  }

  await db
    .update(users)
    .set({ employeeId: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.employeeId, employeeId)));
}

async function syncEmployeeToDevice(
  employee: EmployeeRecord,
  options: { deactivated?: boolean; previousEmployeeCode?: string } = {},
): Promise<void> {
  try {
    if (options.deactivated || !employee.isActive) {
      return;
    }

    if (options.previousEmployeeCode && options.previousEmployeeCode !== employee.employeeCode) {
      console.warn(
        "[device-sync] employee code changed; update device enrollment manually if needed",
        {
          employeeId: employee.id,
          previousEmployeeCode: options.previousEmployeeCode,
          employeeCode: employee.employeeCode,
        },
      );
    }

    await pushEmployeeToDevice(employee.id);
  } catch (error) {
    console.error("[device-sync] failed to push employee to device", {
      employeeId: employee.id,
      error,
    });
  }
}

export async function listEmployees(
  filters: ListEmployeesFilters = {},
): Promise<ServiceSuccess<EmployeeRecord[]>> {
  const conditions = [];

  if (!filters.includeInactive) {
    conditions.push(eq(employees.isActive, true));
  }

  if (filters.companyId) {
    conditions.push(eq(employees.companyId, filters.companyId));
  }

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(employees.fullName, pattern),
        ilike(employees.email, pattern),
        ilike(employees.employeeCode, pattern),
        ilike(employees.department, pattern),
        ilike(employees.designation, pattern),
      ),
    );
  }

  const rows = await db
    .select()
    .from(employees)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(employees.fullName));

  const data = filters.companyId ? dedupeEmployeeRecords(rows) : rows;

  return { ok: true, data };
}

function dedupeEmployeeOptions(rows: EmployeeOption[]): EmployeeOption[] {
  const byCode = new Map<string, EmployeeOption>();
  for (const row of rows) {
    const key = row.employeeCode.trim().toLowerCase();
    const existing = byCode.get(key);
    if (!existing || (!existing.isActive && row.isActive)) {
      byCode.set(key, row);
    }
  }
  return [...byCode.values()].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function listEmployeeOptions(
  filters: Pick<ListEmployeesFilters, "companyId" | "includeInactive"> = {},
): Promise<ServiceSuccess<EmployeeOption[]>> {
  const conditions = [];

  if (!filters.includeInactive) {
    conditions.push(eq(employees.isActive, true));
  }

  if (filters.companyId) {
    conditions.push(eq(employees.companyId, filters.companyId));
  }

  const rows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      isActive: employees.isActive,
    })
    .from(employees)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(employees.fullName));

  return {
    ok: true,
    data: filters.companyId ? dedupeEmployeeOptions(rows) : rows,
  };
}

export async function getEmployee(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  return { ok: true, data: employee };
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const validated = validateEmployeeInput(input);
  if (!validated.ok) {
    return validated;
  }

  const data = validated.data;

  const existingByCode = await findEmployeeByCodeVariants(data.employeeCode);
  if (existingByCode) {
    return adminFailure(
      409,
      "DUPLICATE_EMPLOYEE_CODE",
      `Employee code ${existingByCode.employeeCode} is already assigned to ${existingByCode.fullName} (${existingByCode.email}). Search for that code in Employees and edit the existing record instead of creating a new one.`,
    );
  }

  const [existingEmail] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, data.email))
    .limit(1);
  if (existingEmail) {
    return adminFailure(409, "DUPLICATE_EMAIL", "Email is already assigned to another employee.");
  }

  const probation = resolveCreateProbation(input);
  if (!probation.ok) {
    return probation;
  }

  const companySlug = await resolveCompanySlug(data.companyId);
  const shiftPresetResult = resolveShiftPresetForCompany(companySlug, input.shiftPreset);
  if (!shiftPresetResult.ok) {
    return shiftPresetResult;
  }

  const [created] = await db
    .insert(employees)
    .values({
      employeeCode: data.employeeCode,
      fullName: data.fullName,
      email: data.email,
      companyId: data.companyId,
      department: data.department,
      designation: data.designation,
      probationEnabled: probation.data.probationEnabled,
      probationCompleted: probation.data.probationCompleted,
      probationStartDate: probation.data.probationStartDate,
      probationPeriodMonths: probation.data.probationPeriodMonths,
      shiftPreset: shiftPresetResult.data,
    })
    .returning();

  await linkEmployeeToUserByEmail(created.id, data.email);

  const password = input.password?.trim();
  if (password) {
    const passwordResult = await setEmployeePassword(created.id, password);
    if (!passwordResult.ok) {
      return passwordResult;
    }
  }

  const [linked] = await db.select().from(employees).where(eq(employees.id, created.id)).limit(1);
  const employee = linked ?? created;
  await syncEmployeeToDevice(employee);
  return { ok: true, data: employee };
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const current = await getEmployee(id);
  if (!current.ok) {
    return current;
  }

  const employee = current.data;
  const now = new Date();
  const updates: Partial<typeof employees.$inferInsert> = { updatedAt: now };

  if (input.employeeCode !== undefined) {
    const code = input.employeeCode.trim();
    if (!code) {
      return adminFailure(400, "INVALID_EMPLOYEE_CODE", "Employee code cannot be empty.");
    }
    if (code !== employee.employeeCode) {
      const duplicate = await findEmployeeByCodeVariants(code);
      if (duplicate && duplicate.id !== employee.id) {
        return adminFailure(
          409,
          "DUPLICATE_EMPLOYEE_CODE",
          `Employee code ${duplicate.employeeCode} is already assigned to ${duplicate.fullName} (${duplicate.email}).`,
        );
      }
      updates.employeeCode = code;
    }
  }

  if (input.fullName !== undefined) {
    const name = input.fullName.trim();
    if (!name) {
      return adminFailure(400, "INVALID_NAME", "Full name cannot be empty.");
    }
    updates.fullName = name;
  }

  if (input.department !== undefined) {
    updates.department = input.department?.trim() || null;
  }

  if (input.designation !== undefined) {
    updates.designation = input.designation?.trim() || null;
  }

  if (input.shiftPreset !== undefined) {
    const companySlug = await resolveCompanySlug(employee.companyId);
    const shiftPresetResult = resolveShiftPresetForCompany(companySlug, input.shiftPreset);
    if (!shiftPresetResult.ok) {
      return shiftPresetResult;
    }
    updates.shiftPreset = shiftPresetResult.data;
  }

  if (input.isActive !== undefined) {
    updates.isActive = input.isActive;
  }

  if (input.probationCompleted === true) {
    updates.probationCompleted = true;
    updates.probationEnabled = false;
    updates.probationStartDate = null;
  } else if (
    input.probationCompleted === false ||
    input.probationEnabled !== undefined ||
    input.probationStartDate !== undefined ||
    input.probationPeriodMonths !== undefined
  ) {
    const nextProbationCompleted =
      input.probationCompleted !== undefined
        ? input.probationCompleted
        : employee.probationCompleted;
    const nextProbationEnabled =
      input.probationEnabled !== undefined ? input.probationEnabled : employee.probationEnabled;

    if (input.probationCompleted === false) {
      updates.probationCompleted = false;
    }

    if (input.probationEnabled !== undefined) {
      updates.probationEnabled = input.probationEnabled;
      if (!input.probationEnabled) {
        updates.probationStartDate = null;
      } else if (!employee.probationStartDate && input.probationStartDate === undefined) {
        updates.probationStartDate = getTodayPkt();
      }
    }

    if (!nextProbationCompleted) {
      if (input.probationStartDate !== undefined || input.probationEnabled === true) {
        const startValidated = validateProbationStartDate(
          input.probationStartDate ?? employee.probationStartDate,
          nextProbationEnabled,
        );
        if (!startValidated.ok) {
          return startValidated;
        }
        if (nextProbationEnabled) {
          updates.probationStartDate = startValidated.data;
        }
      }

      if (input.probationPeriodMonths !== undefined) {
        const monthsValidated = validateProbationPeriodMonths(input.probationPeriodMonths);
        if (!monthsValidated.ok) {
          return monthsValidated;
        }
        updates.probationPeriodMonths = monthsValidated.data;
      }
    }
  }

  let emailChanged = false;
  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) {
      return adminFailure(400, "INVALID_EMAIL", "A valid email address is required.");
    }
    if (email !== employee.email) {
      const [duplicate] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.email, email))
        .limit(1);
      if (duplicate) {
        return adminFailure(
          409,
          "DUPLICATE_EMAIL",
          "Email is already assigned to another employee.",
        );
      }
      updates.email = email;
      emailChanged = true;
    }
  }

  const [updated] = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();

  if (!updated) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const shiftPresetChanged =
    updates.shiftPreset !== undefined && updates.shiftPreset !== employee.shiftPreset;
  if (shiftPresetChanged) {
    const year = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy");
    const { recalcEmployeeLateFlags } = await import("@/lib/admin/recalc-employee-late-flags");
    await recalcEmployeeLateFlags({
      employeeId: id,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    });
  }

  const employeeCodeChanged =
    updates.employeeCode !== undefined && updates.employeeCode !== employee.employeeCode;
  const deactivated = updates.isActive === false;

  if (emailChanged) {
    await unlinkEmployeeUser(id, employee.userId);
    await db.update(employees).set({ userId: null, updatedAt: now }).where(eq(employees.id, id));
    await linkEmployeeToUserByEmail(id, updated.email);
  }

  const password = input.password?.trim();
  if (password) {
    const passwordResult = await setEmployeePassword(id, password);
    if (!passwordResult.ok) {
      return passwordResult;
    }
  }

  const [reloaded] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  const result = reloaded ?? updated;
  await syncEmployeeToDevice(result, {
    deactivated,
    previousEmployeeCode: employeeCodeChanged ? employee.employeeCode : undefined,
  });
  return { ok: true, data: result };
}

export type DeactivateEmployeeOptions = {
  closeOpenShift?: boolean;
};

export type EmployeeDeactivationPreview = {
  hasOpenShift: boolean;
  openShiftState: "checked_in" | "on_break" | null;
};

export async function getEmployeeDeactivationPreview(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<EmployeeDeactivationPreview>> {
  const current = await getEmployee(id);
  if (!current.ok) {
    return current;
  }

  const openShift = await findOpenShift(id);
  return {
    ok: true,
    data: {
      hasOpenShift: openShift != null,
      openShiftState: openShift?.state ?? null,
    },
  };
}

export async function deactivateEmployee(
  id: string,
  options: DeactivateEmployeeOptions = {},
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const current = await getEmployee(id);
  if (!current.ok) {
    return current;
  }

  if (!current.data.isActive) {
    return adminFailure(409, "ALREADY_INACTIVE", "Employee is already inactive.");
  }

  const openShift = await findOpenShift(id);
  if (openShift && !options.closeOpenShift) {
    const stateLabel = openShift.state === "on_break" ? "on break" : "checked in";
    return adminFailure(
      409,
      "OPEN_SHIFT_ACTIVE",
      `Employee is still ${stateLabel} for shift ${openShift.shiftDate}. Confirm to close the shift and deactivate.`,
    );
  }

  if (openShift) {
    await closeOpenShiftForEmployee(id);
  }

  return updateEmployee(id, { isActive: false });
}

export async function startEmployeeProbation(
  id: string,
  options: { periodMonths?: number } = {},
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  const defaults = defaultProbationValues();
  return updateEmployee(id, {
    probationEnabled: true,
    probationCompleted: false,
    probationStartDate: defaults.probationStartDate,
    probationPeriodMonths: options.periodMonths ?? defaults.probationPeriodMonths,
  });
}

export async function endEmployeeProbation(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<EmployeeRecord>> {
  return updateEmployee(id, {
    probationEnabled: false,
    probationCompleted: true,
    probationStartDate: null,
  });
}
