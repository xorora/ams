/**
 * Delete Shahbaz Afzal (001) approved sick leave for 2026-07-07 and restore balance.
 *
 *   npx vercel env run -e production -- npx tsx scripts/delete-shahbaz-sick-leave.ts
 *   npx vercel env run -e production -- npx tsx scripts/delete-shahbaz-sick-leave.ts --dry-run
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
  loadEnvFile(".env.vercel.tmp");
  loadEnvFile(".env.vercel.production");
  loadEnvFile(".env.local");

  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Run with: npx vercel env run -e production -- npx tsx scripts/delete-shahbaz-sick-leave.ts",
    );
  }

  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { employees, leaveRequests } = await import("../src/db/schema");
  const { deleteLeaveRequest, getLeaveBalances } = await import("../src/lib/leave/leave-service");

  const employeeRows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
    })
    .from(employees)
    .where(
      and(
        sql`lower(${employees.employeeCode}) = ${"001"}`,
        sql`lower(${employees.fullName}) like ${"%shahbaz%"}`,
      ),
    );

  if (employeeRows.length === 0) {
    // Fallback: code only
    const byCode = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
      })
      .from(employees)
      .where(sql`lower(${employees.employeeCode}) = ${"001"}`);
    employeeRows.push(...byCode);
  }

  if (employeeRows.length === 0) {
    throw new Error("Employee 001 / Shahbaz not found.");
  }

  console.log(
    "Employees matched:",
    employeeRows.map((e) => `${e.employeeCode} ${e.fullName} (${e.id})`).join(", "),
  );

  const matches = [];
  for (const emp of employeeRows) {
    const rows = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, emp.id),
          eq(leaveRequests.leaveType, "sick"),
          eq(leaveRequests.startDate, "2026-07-07"),
          eq(leaveRequests.endDate, "2026-07-07"),
          eq(leaveRequests.status, "approved"),
        ),
      );
    for (const row of rows) {
      matches.push({ emp, row });
    }
  }

  if (matches.length === 0) {
    throw new Error(
      "No approved sick leave found for 2026-07-07 (employee 001 / Shahbaz).",
    );
  }

  for (const { emp, row } of matches) {
    console.log(
      `Found leave ${row.id}: ${emp.employeeCode} ${emp.fullName} sick ${row.startDate}–${row.endDate} (${row.daysCount}d) status=${row.status}`,
    );

    const before = await getLeaveBalances(emp.id, 2026);
    if (before.ok) {
      const sick = before.data.find((b) => b.leaveType === "sick");
      console.log("Sick balance before:", sick);
    }

    if (dryRun) {
      console.log("Dry run — not deleting.");
      continue;
    }

    const result = await deleteLeaveRequest(row.id);
    if (!result.ok) {
      throw new Error(result.message);
    }

    console.log(
      `Deleted leave ${result.data.deleted.id}; attendance cleared: ${result.data.attendanceCleared}`,
    );

    const after = await getLeaveBalances(emp.id, 2026);
    if (after.ok) {
      const sick = after.data.find((b) => b.leaveType === "sick");
      console.log("Sick balance after:", sick);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
