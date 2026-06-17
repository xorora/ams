import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import type { Coordinates } from "./coords";
import { isWithinOfficeRadius } from "./geofence";
import { getOfficeGeofence } from "./office-settings";

export type EmployeeAccessFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type EmployeeAccessSuccess = {
  ok: true;
  employee: typeof employees.$inferSelect;
};

export async function requireActiveEmployee(
  employeeId: string,
): Promise<EmployeeAccessFailure | EmployeeAccessSuccess> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);

  if (!employee) {
    return {
      ok: false,
      status: 403,
      code: "EMPLOYEE_NOT_FOUND",
      message: "Your account is not linked to an employee record.",
    };
  }

  if (!employee.isActive) {
    return {
      ok: false,
      status: 403,
      code: "EMPLOYEE_INACTIVE",
      message: "Your employee record is deactivated. Contact HR.",
    };
  }

  return { ok: true, employee };
}

export async function getEmployeeCompanySlug(employeeId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: companies.slug })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  return row?.slug ?? null;
}

export async function requireWithinGeofence(
  coords: Coordinates,
): Promise<EmployeeAccessFailure | { ok: true }> {
  const officeResult = await getOfficeGeofence();
  if (!officeResult.ok) {
    return {
      ok: false,
      status: 503,
      code: "OFFICE_NOT_CONFIGURED",
      message: officeResult.error,
    };
  }

  if (!isWithinOfficeRadius(coords.lat, coords.lng, officeResult.office)) {
    return {
      ok: false,
      status: 403,
      code: "OUTSIDE_GEOFENCE",
      message: "You must be at the office to perform this action.",
    };
  }

  return { ok: true };
}
