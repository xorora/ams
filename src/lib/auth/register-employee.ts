import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";
import { defaultProbationValues } from "@/lib/admin/probation";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import {
  findEmployeeByCode,
  generateUniqueEmployeeCode,
  normalizeEmployeeCode,
} from "@/lib/auth/employee-code";

export type RegisterEmployeeResult = {
  employee: typeof employees.$inferSelect;
  created: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromUser(user: typeof users.$inferSelect, email: string): string | null {
  const fromProfile = user.name?.trim();
  if (fromProfile) {
    return fromProfile;
  }
  const local = email.split("@")[0]?.trim();
  return local || null;
}

async function linkUserToEmployee(userId: string, employeeId: string): Promise<void> {
  const now = new Date();
  await db.update(employees).set({ userId, updatedAt: now }).where(eq(employees.id, employeeId));
  await db.update(users).set({ employeeId, updatedAt: now }).where(eq(users.id, userId));
}

async function validateAndLinkExisting(
  user: typeof users.$inferSelect,
  userEmail: string,
  employee: typeof employees.$inferSelect,
): Promise<ServiceFailure | ServiceSuccess<RegisterEmployeeResult>> {
  if (!employee.isActive) {
    return adminFailure(
      403,
      "EMPLOYEE_INACTIVE",
      "This employee record is deactivated. Contact your administrator.",
    );
  }

  if (employee.userId && employee.userId !== user.id) {
    return adminFailure(
      409,
      "ALREADY_LINKED",
      "This employee record is already linked to another account.",
    );
  }

  if (user.employeeId && user.employeeId !== employee.id) {
    return adminFailure(409, "USER_ALREADY_LINKED", "Your account is already linked.");
  }

  const email = normalizeEmail(userEmail);
  const now = new Date();

  await db
    .update(employees)
    .set({
      email,
      fullName: user.name?.trim() || employee.fullName,
      updatedAt: now,
    })
    .where(eq(employees.id, employee.id));

  await db
    .update(users)
    .set({
      email,
      name: user.name?.trim() || user.name,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  if (!employee.userId || !user.employeeId) {
    await linkUserToEmployee(user.id, employee.id);
  }

  const [linked] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
  return { ok: true, data: { employee: linked ?? employee, created: false } };
}

async function createAndLinkEmployee(
  user: typeof users.$inferSelect,
  userEmail: string,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<RegisterEmployeeResult>> {
  const email = normalizeEmail(userEmail);
  const fullName = displayNameFromUser(user, email);
  if (!fullName) {
    return adminFailure(
      400,
      "INVALID_NAME",
      "Your Google profile has no name. Update your profile and try again.",
    );
  }

  const [emailTaken] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);
  if (emailTaken) {
    return adminFailure(
      409,
      "EMAIL_IN_USE",
      "Your email is already on an employee record. Contact your administrator.",
    );
  }

  const employeeCode = await generateUniqueEmployeeCode();
  const probation = defaultProbationValues();
  const [created] = await db
    .insert(employees)
    .values({
      employeeCode,
      fullName,
      email,
      companyId,
      probationEnabled: probation.probationEnabled,
      probationCompleted: probation.probationCompleted,
      probationStartDate: probation.probationStartDate,
      probationPeriodMonths: probation.probationPeriodMonths,
    })
    .returning();

  await linkUserToEmployee(user.id, created.id);

  const [linked] = await db.select().from(employees).where(eq(employees.id, created.id)).limit(1);
  return { ok: true, data: { employee: linked ?? created, created: true } };
}

async function resolveActiveCompanyId(companyId: string): Promise<string | null> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.isActive, true)))
    .limit(1);

  return company?.id ?? null;
}

export async function registerEmployee(
  userId: string,
  userEmail: string,
  employeeCode: string,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<RegisterEmployeeResult>> {
  const code = normalizeEmployeeCode(employeeCode);
  if (!code) {
    return adminFailure(400, "INVALID_EMPLOYEE_CODE", "Employee code is required.");
  }

  if (!companyId.trim()) {
    return adminFailure(400, "INVALID_COMPANY", "Company is required.");
  }

  const activeCompanyId = await resolveActiveCompanyId(companyId);
  if (!activeCompanyId) {
    return adminFailure(400, "INVALID_COMPANY", "Select a valid company.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return adminFailure(404, "USER_NOT_FOUND", "User account not found.");
  }

  const employee = await findEmployeeByCode(code);
  if (employee) {
    return validateAndLinkExisting(user, userEmail, employee);
  }

  return createAndLinkEmployee(user, userEmail, activeCompanyId);
}
