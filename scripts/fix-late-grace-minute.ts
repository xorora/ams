/**
 * Clear is_late for check-ins in the inclusive grace minute (:15).
 *
 *   vercel env run -e production -- npx tsx scripts/fix-late-grace-minute.ts [--dry-run]
 *
 * Prefer Admin → Attendance → "Clear late for :15 arrivals" if DATABASE_URL is Sensitive.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Use Admin → Attendance → Clear late for :15 arrivals, or set DATABASE_URL.",
    );
  }

  const { fixLateGraceMinuteCheckIns } = await import("../src/lib/admin/fix-late-grace-minute");

  if (dryRun) {
    const { db } = await import("../src/db");
    const { attendanceDays, companies, employees } = await import("../src/db/schema");
    const { getCompanyShiftConfig } = await import("../src/lib/attendance/company-shift");
    const { BUSINESS_TIMEZONE } = await import("../src/lib/attendance/constants");
    const { and, eq, sql } = await import("drizzle-orm");
    const { formatInTimeZone } = await import("date-fns-tz");

    const companyRows = await db
      .select({ id: companies.id, name: companies.name, slug: companies.slug })
      .from(companies);

    let count = 0;
    for (const company of companyRows) {
      const shiftConfig = getCompanyShiftConfig(company.slug);
      const graceTotal =
        shiftConfig.expectedCheckInHour * 60 +
        shiftConfig.expectedCheckInMinute +
        shiftConfig.checkInGraceMinutes;
      const graceHour = Math.floor(graceTotal / 60) % 24;
      const graceMinute = graceTotal % 60;

      const rows = await db
        .select({
          employeeCode: employees.employeeCode,
          fullName: employees.fullName,
          shiftDate: attendanceDays.shiftDate,
          checkInAt: attendanceDays.checkInAt,
        })
        .from(attendanceDays)
        .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
        .where(
          and(
            eq(employees.companyId, company.id),
            eq(attendanceDays.isLate, true),
            sql`${attendanceDays.checkInAt} IS NOT NULL`,
          ),
        );

      for (const row of rows) {
        if (!row.checkInAt) continue;
        const hour = Number(formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "H"));
        const minute = Number(formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "m"));
        if (hour !== graceHour || minute !== graceMinute) continue;
        count += 1;
        console.log(
          `- ${company.name} | ${row.employeeCode} ${row.fullName} | ${row.shiftDate} | ${formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "h:mm:ss a")}`,
        );
      }
    }
    console.log(`Dry run: would update ${count} record(s).`);
    return;
  }

  const result = await fixLateGraceMinuteCheckIns();
  for (const row of result.rows) {
    console.log(
      `- ${row.company} | ${row.employeeCode} ${row.fullName} | ${row.shiftDate} | ${row.checkInPkt}`,
    );
  }
  console.log(`Updated ${result.updated} attendance day(s) to on-time.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
