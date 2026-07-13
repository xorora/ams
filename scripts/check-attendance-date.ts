import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, gte, lte } from "drizzle-orm";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
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

async function main() {
  loadEnvFile(".env.vercel.production");
  loadEnvFile(".env.local");

  const shiftDate = process.argv[2] ?? "2026-07-09";
  const companySlug = process.argv[3] ?? "xorora";

  const { db } = await import("../src/db");
  const { attendanceDays, companies, employees } = await import("../src/db/schema");
  const { effectiveAttendanceStatus } = await import("../src/lib/attendance/effective-status");

  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.slug, companySlug))
    .limit(1);

  if (!company) {
    throw new Error(`Company not found: ${companySlug}`);
  }

  const rows = await db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      isActive: employees.isActive,
      shiftDate: attendanceDays.shiftDate,
      status: attendanceDays.status,
      checkInAt: attendanceDays.checkInAt,
      checkOutAt: attendanceDays.checkOutAt,
      isLate: attendanceDays.isLate,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(
      and(
        eq(employees.companyId, company.id),
        eq(attendanceDays.shiftDate, shiftDate),
      ),
    )
    .orderBy(employees.fullName);

  const activeEmployees = await db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)))
    .orderBy(employees.fullName);

  const byCode = new Map(rows.map((row) => [row.employeeCode, row]));
  const summary = activeEmployees.map((employee) => {
    const row = byCode.get(employee.employeeCode);
    if (!row) {
      return {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        status: "no row",
        checkInAt: null,
        checkOutAt: null,
        isLate: false,
      };
    }

    return {
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      status: effectiveAttendanceStatus(row),
      checkInAt: row.checkInAt?.toISOString() ?? null,
      checkOutAt: row.checkOutAt?.toISOString() ?? null,
      isLate: row.isLate,
    };
  });

  const withCheckIn = summary.filter((row) => row.checkInAt);
  const withoutCheckIn = summary.filter((row) => !row.checkInAt);

  console.log(
    JSON.stringify(
      {
        company: company.name,
        shiftDate,
        activeEmployees: summary.length,
        withCheckIn: withCheckIn.length,
        withoutCheckIn: withoutCheckIn.length,
        employees: summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
