import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeCode, code))
    .limit(1);

  if (!employee) {
    return adminFailure(
      404,
      "EMPLOYEE_NOT_FOUND",
      "No employee record matches that code. Ask your administrator to add you first.",
    );
  }

  if (!employee.isActive) {
    return adminFailure(
      403,
      "EMPLOYEE_INACTIVE",
      "This employee record is deactivated. Contact your administrator.",
    );
  }

  if (normalizeEmail(employee.email) !== normalizeEmail(userEmail)) {
    return adminFailure(
      403,
      "EMAIL_MISMATCH",
      "This employee code is not registered to your Google account email.",
    );
  }

  if (employee.userId && employee.userId !== userId) {
    return adminFailure(
      409,
      "ALREADY_LINKED",
      "This employee record is already linked to another account.",
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return adminFailure(404, "USER_NOT_FOUND", "User account not found.");
  }

  if (user.employeeId && user.employeeId !== employee.id) {
    return adminFailure(409, "USER_ALREADY_LINKED", "Your account is already linked.");
  }

  const now = new Date();

  if (!employee.userId) {
    await db.update(employees).set({ userId, updatedAt: now }).where(eq(employees.id, employee.id));
  }

  if (!user.employeeId) {
    await db
      .update(users)
      .set({ employeeId: employee.id, updatedAt: now })
      .where(eq(users.id, userId));
  }

  const [linked] = await db.select().from(employees).where(eq(employees.id, employee.id)).limit(1);
  return { ok: true, data: linked ?? employee };
}
