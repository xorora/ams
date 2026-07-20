import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import {
  type CompanyShiftConfig,
  getShiftConfigForEmployee,
} from "./company-shift";

export async function loadEmployeeShiftContext(employeeId: string): Promise<{
  config: CompanyShiftConfig;
  companySlug: string;
  fullName: string | null;
  shiftPreset: string | null;
}> {
  const [row] = await db
    .select({
      slug: companies.slug,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
    })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  const companySlug = row?.slug ?? "xorora";
  return {
    companySlug,
    fullName: row?.fullName ?? null,
    shiftPreset: row?.shiftPreset ?? null,
    config: getShiftConfigForEmployee(companySlug, row?.shiftPreset, row?.fullName),
  };
}

export async function loadEmployeeShiftConfig(
  employeeId: string,
): Promise<CompanyShiftConfig> {
  const { config } = await loadEmployeeShiftContext(employeeId);
  return config;
}
