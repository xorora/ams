import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { defaultProbationValues } from "@/lib/admin/probation";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";

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
  options: { requireEmailMatch: boolean },
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  if (!employee.isActive) {
    return adminFailure(
      403,
      "EMPLOYEE_INACTIVE",
      "This employee record is deactivated. Contact your administrator.",
    );
  }

  if (options.requireEmailMatch && normalizeEmail(employee.email) !== normalizeEmail(userEmail)) {
    return adminFailure(
      403,
      "EMAIL_MISMATCH",
      "This employee code is not registered to your Google account email.",
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

  if (!employee.userId || !user.employeeId) {
    await linkUserToEmployee(user.id, employee.id);
  }

  const [linked] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
  return { ok: true, data: linked ?? employee };
}

async function createAndLinkEmployee(
  user: typeof users.$inferSelect,
  userEmail: string,
  employeeCode: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
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
      "Your email is already on an employee record. Enter the matching employee code or contact your administrator.",
    );
  }

  const probation = defaultProbationValues();
  const [created] = await db
    .insert(employees)
    .values({
      employeeCode,
      fullName,
      email,
      probationEnabled: probation.probationEnabled,
      probationCompleted: probation.probationCompleted,
      probationStartDate: probation.probationStartDate,
      probationPeriodMonths: probation.probationPeriodMonths,
    })
    .returning();

  await linkUserToEmployee(user.id, created.id);

  const [linked] = await db.select().from(employees).where(eq(employees.id, created.id)).limit(1);
  return { ok: true, data: linked ?? created };
}

export async function linkEmployeeByCode(
  userId: string,
  userEmail: string,
  employeeCode: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  const code = employeeCode.trim();
  if (!code) {
    return adminFailure(400, "INVALID_EMPLOYEE_CODE", "Employee code is required.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return adminFailure(404, "USER_NOT_FOUND", "User account not found.");
  }

  const normalizedEmail = normalizeEmail(userEmail);

  const [employeeByEmail] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, normalizedEmail))
    .limit(1);

  if (employeeByEmail) {
    return validateAndLinkExisting(user, userEmail, employeeByEmail, {
      requireEmailMatch: false,
    });
  }

  const [employeeByCode] = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeCode, code))
    .limit(1);

  if (employeeByCode) {
    return validateAndLinkExisting(user, userEmail, employeeByCode, {
      requireEmailMatch: true,
    });
  }

  return createAndLinkEmployee(user, userEmail, code);
}
