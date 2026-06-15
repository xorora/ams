import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { attendanceDays, employees, machinePunches } from "../src/db/schema";

function parseEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};

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
    if (!key) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadEnvFiles(filenames: string[]) {
  for (const filename of filenames) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) {
      continue;
    }
    for (const [key, value] of Object.entries(parseEnvFile(path))) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFiles([".env", ".env.local"]);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Set it in .env.local.");
}

const db = drizzle(neon(databaseUrl));

async function main() {
  const { relinkMachinePunchesToEmployees, runProcessMachinePunchesJob } = await import(
    "../src/lib/attendance/machine-punch-processor"
  );

  const [{ count: totalPunches }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(machinePunches);
  const [{ count: unlinkedBefore }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(machinePunches)
    .where(sql`${machinePunches.employeeId} IS NULL`);

  console.log(`machine_punches: total=${totalPunches}, unlinked=${unlinkedBefore}`);

  const relinked = await relinkMachinePunchesToEmployees();
  console.log(`Relinked ${relinked} punch row(s) to employees.`);

  const [{ count: unlinkedAfter }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(machinePunches)
    .where(sql`${machinePunches.employeeId} IS NULL`);
  const [{ count: linkedAfter }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(machinePunches)
    .where(sql`${machinePunches.employeeId} IS NOT NULL`);

  console.log(`After relink: linked=${linkedAfter}, still_unlinked=${unlinkedAfter}`);

  const [{ count: attendanceBefore }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceDays);

  const result = await runProcessMachinePunchesJob();
  console.log("Processor result:", result);

  const [{ count: attendanceAfter }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceDays);

  console.log(
    `attendance_days: before=${attendanceBefore}, after=${attendanceAfter}, new=${attendanceAfter - attendanceBefore}`,
  );

  const [{ count: crestLedWithCard }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(sql`${employees.machineCardNo} IS NOT NULL`);

  console.log(`employees with machine_card_no: ${crestLedWithCard}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
