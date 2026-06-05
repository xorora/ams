import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import {
  DEFAULT_PROBATION_PERIOD_MONTHS,
  defaultProbationValues,
  getTodayPkt,
} from "@/lib/admin/probation";
import { closeOpenShiftForEmployee, findOpenShift } from "@/lib/attendance/close-open-shift";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export type EmployeeRecord = typeof employees.$inferSelect;

export type CreateEmployeeInput = {
  employeeCode: string;
  fullName: string;
  email: string;
  department?: string | null;
  probationEnabled?: boolean;
  probationCompleted?: boolean;
  probationStartDate?: string | null;
  probationPeriodMonths?: number;
};

export type UpdateEmployeeInput = {
  employeeCode?: string;
  fullName?: string;
  email?: string;
  department?: string | null;
  isActive?: boolean;
  probationEnabled?: boolean;
  probationCompleted?: boolean;
  probationStartDate?: string | null;
  probationPeriodMonths?: number;
};

export type ListEmployeesFilters = {
  includeInactive?: boolean;
  search?: string;
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
): ServiceFailure | ServiceSuccess<CreateEmployeeInput> {
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

  return {
    ok: true,
    data: {
      employeeCode,
      fullName,
      email,
      department: input.department?.trim() || null,
    },
  };
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

async function unlinkEmployeeUser(employeeId: string, userId: string | null): Promise<void> {
  if (!userId) {
    return;
  }

  await db
    .update(users)
    .set({ employeeId: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.employeeId, employeeId)));
}

export async function listEmployees(
  filters: ListEmployeesFilters = {},
): Promise<ServiceSuccess<EmployeeRecord[]>> {
  const conditions = [];

  if (!filters.includeInactive) {
    conditions.push(eq(employees.isActive, true));
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
      ),
    );
  }

  const rows = await db
    .select()
    .from(employees)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(employees.fullName));

  return { ok: true, data: rows };
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

  const [existingCode] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeCode, data.employeeCode))
    .limit(1);
  if (existingCode) {
    return adminFailure(409, "DUPLICATE_EMPLOYEE_CODE", "Employee code is already in use.");
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

  const [created] = await db
    .insert(employees)
    .values({
      employeeCode: data.employeeCode,
      fullName: data.fullName,
      email: data.email,
      department: data.department,
      probationEnabled: probation.data.probationEnabled,
      probationCompleted: probation.data.probationCompleted,
      probationStartDate: probation.data.probationStartDate,
      probationPeriodMonths: probation.data.probationPeriodMonths,
    })
    .returning();

  await linkEmployeeToUserByEmail(created.id, data.email);

  const [linked] = await db.select().from(employees).where(eq(employees.id, created.id)).limit(1);
  return { ok: true, data: linked ?? created };
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
      const [duplicate] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.employeeCode, code))
        .limit(1);
      if (duplicate) {
        return adminFailure(409, "DUPLICATE_EMPLOYEE_CODE", "Employee code is already in use.");
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

  if (emailChanged) {
    await unlinkEmployeeUser(id, employee.userId);
    await db.update(employees).set({ userId: null, updatedAt: now }).where(eq(employees.id, id));
    await linkEmployeeToUserByEmail(id, updated.email);
    const [reloaded] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return { ok: true, data: reloaded ?? updated };
  }

  return { ok: true, data: updated };
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
