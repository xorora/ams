import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";
import { findEmployeeByCodeVariants } from "@/lib/admin/employee-identity";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import { normalizeEmployeeCode } from "@/lib/auth/employee-code";

export type RegisterEmployeeResult = {
  employee: typeof employees.$inferSelect;
  created: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function validateAndLinkExisting(
  user: typeof users.$inferSelect,
  userEmail: string,
  employee: typeof employees.$inferSelect,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<RegisterEmployeeResult>> {
  if (employee.companyId !== companyId) {
    return adminFailure(
      400,
      "COMPANY_MISMATCH",
      "That employee code does not belong to the selected company.",
    );
  }

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

  const [emailOnOtherEmployee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  if (emailOnOtherEmployee && emailOnOtherEmployee.id !== employee.id) {
    return adminFailure(
      409,
      "EMAIL_IN_USE",
      "Your email is already on another employee record. Contact your administrator.",
    );
  }

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
    await linkUserToEmployeeRecord(user.id, employee.id);
  }

  const [linked] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
  return { ok: true, data: { employee: linked ?? employee, created: false } };
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

  const employee = await findEmployeeByCodeVariants(code);
  if (!employee) {
    return adminFailure(
      404,
      "EMPLOYEE_NOT_FOUND",
      "No employee found for that code. Employees must be created by an administrator.",
    );
  }

  return validateAndLinkExisting(user, userEmail, employee, activeCompanyId);
}
