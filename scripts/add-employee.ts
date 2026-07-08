import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createEmployee,
  updateEmployee,
} from "../src/lib/admin/employees-service";
import { findEmployeeByCodeVariants } from "../src/lib/admin/employee-identity";
import { getTodayPkt } from "../src/lib/admin/probation";
import { getCompanyIdBySlug } from "../src/lib/auth/company";
import { db } from "../src/db";
import { employees } from "../src/db/schema";
import { eq } from "drizzle-orm";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

type EmployeeSeed = {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  probationEnabled: boolean;
  probationStartDate: string;
};

async function main() {
  const [employee] = process.argv.slice(2);
  const seed: EmployeeSeed =
    employee === "waqas"
      ? {
          employeeCode: "011",
          fullName: "Waqas Raza",
          email: "waqas.raza@xorora.com",
          department: "Xorora - Marketing",
          designation: "Digital Marketing Executive",
          probationEnabled: true,
          probationStartDate: getTodayPkt(),
        }
      : {
          employeeCode: process.env.EMPLOYEE_CODE?.trim() ?? "",
          fullName: process.env.EMPLOYEE_NAME?.trim() ?? "",
          email: process.env.EMPLOYEE_EMAIL?.trim().toLowerCase() ?? "",
          department: process.env.EMPLOYEE_DEPARTMENT?.trim() ?? "",
          designation: process.env.EMPLOYEE_DESIGNATION?.trim() ?? "",
          probationEnabled: process.env.EMPLOYEE_PROBATION === "true",
          probationStartDate: process.env.EMPLOYEE_PROBATION_START?.trim() || getTodayPkt(),
        };

  if (!seed.employeeCode || !seed.fullName || !seed.email) {
    console.error(
      "Usage: bun run add:employee\n" +
        "Or: bun scripts/add-employee.ts waqas\n" +
        "Or set EMPLOYEE_CODE, EMPLOYEE_NAME, EMPLOYEE_EMAIL, and optional department/designation env vars.",
    );
    process.exit(1);
  }

  const companyId = await getCompanyIdBySlug("xorora");
  if (!companyId) {
    throw new Error("Xorora company not found in the database.");
  }

  const payload = {
    employeeCode: seed.employeeCode,
    fullName: seed.fullName,
    email: seed.email,
    companyId,
    department: seed.department,
    designation: seed.designation,
    probationEnabled: seed.probationEnabled,
    probationCompleted: false,
    probationStartDate: seed.probationEnabled ? seed.probationStartDate : null,
  };

  const existingByCode = await findEmployeeByCodeVariants(seed.employeeCode);
  const [existingByEmail] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, seed.email.toLowerCase()))
    .limit(1);
  const existingId = existingByCode?.id ?? existingByEmail?.id;

  const result = existingId
    ? await updateEmployee(existingId, {
        employeeCode: payload.employeeCode,
        fullName: payload.fullName,
        email: payload.email,
        department: payload.department,
        designation: payload.designation,
        isActive: true,
        probationEnabled: payload.probationEnabled,
        probationCompleted: false,
        probationStartDate: payload.probationStartDate,
      })
    : await createEmployee(payload);

  if (!result.ok) {
    console.error(`Failed: ${result.message} (${result.code})`);
    process.exit(1);
  }

  console.log(existingId ? "Employee updated:" : "Employee created:");
  console.log(`  id: ${result.data.id}`);
  console.log(`  code: ${result.data.employeeCode}`);
  console.log(`  name: ${result.data.fullName}`);
  console.log(`  email: ${result.data.email}`);
  console.log(`  department: ${result.data.department}`);
  console.log(`  designation: ${result.data.designation}`);
  console.log(`  probation start: ${result.data.probationStartDate}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
