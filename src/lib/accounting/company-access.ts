import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";

export async function getEmployeeInCompany(
  employeeId: string,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employees.$inferSelect>> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);

  if (!employee) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  if (employee.companyId !== companyId) {
    return adminFailure(403, "COMPANY_MISMATCH", "Employee does not belong to this company.");
  }

  return { ok: true, data: employee };
}

export function assertCompanyScope(
  resourceCompanyId: string,
  scopeCompanyId: string | null,
  role: "admin" | "accounting_admin" | "employee",
): ServiceFailure | ServiceSuccess<void> {
  if (role === "admin") {
    return { ok: true, data: undefined };
  }

  if (!scopeCompanyId) {
    return adminFailure(403, "NO_COMPANY_SCOPE", "No company scope is configured for this user.");
  }

  if (resourceCompanyId !== scopeCompanyId) {
    return adminFailure(403, "COMPANY_MISMATCH", "Resource is outside your company scope.");
  }

  return { ok: true, data: undefined };
}
