import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import {
  type CompanyShiftConfig,
  getCompanyShiftConfig,
  getShiftConfigForEmployee,
  getShiftDateForCompany,
} from "./company-shift";

export async function loadEmployeeShiftContext(
  employeeId: string,
  at: Date = new Date(),
): Promise<{
  config: CompanyShiftConfig;
  companySlug: string;
  fullName: string | null;
  shiftPreset: string | null;
  shiftDate: string;
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
  const provisional = getCompanyShiftConfig(companySlug);
  const shiftDate = getShiftDateForCompany(at, provisional);
  const fullName = row?.fullName ?? null;
  const shiftPreset = row?.shiftPreset ?? null;

  return {
    companySlug,
    fullName,
    shiftPreset,
    shiftDate,
    config: getShiftConfigForEmployee(companySlug, shiftPreset, fullName, shiftDate),
  };
}

export async function loadEmployeeShiftConfig(
  employeeId: string,
  at: Date = new Date(),
): Promise<CompanyShiftConfig> {
  const { config } = await loadEmployeeShiftContext(employeeId, at);
  return config;
}
