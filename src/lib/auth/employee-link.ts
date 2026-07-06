import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";

/** Point a user account at the employee record used for attendance. */
export async function linkUserToEmployeeRecord(
  userId: string,
  employeeId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(employees)
    .set({ userId: null, updatedAt: now })
    .where(eq(employees.userId, userId));
  await db.update(employees).set({ userId, updatedAt: now }).where(eq(employees.id, employeeId));
  await db.update(users).set({ employeeId, updatedAt: now }).where(eq(users.id, userId));
}
