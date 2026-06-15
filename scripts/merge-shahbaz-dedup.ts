/**
 * One-off: merge CL-61 (Crest LED duplicate) into Shahbaz Afzal (Xorora 001),
 * same treatment as Zarrar / CL-72.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { attendanceDays, employees, machinePunches } from "../src/db/schema";

function parseEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
}

function loadEnvFiles(filenames: string[]) {
  for (const filename of filenames) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnvFile(path))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnvFiles([".env", ".env.local"]);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const db = drizzle(neon(databaseUrl));

const SHAHBAZ_EMPLOYEE_CODE = "001";
const SHAHBAZ_MACHINE_CARD_NO = "00000061";
const CL61_EMPLOYEE_CODE = "CL-61";

async function main() {
  const [shahbaz] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      machineCardNo: employees.machineCardNo,
    })
    .from(employees)
    .where(eq(employees.employeeCode, SHAHBAZ_EMPLOYEE_CODE))
    .limit(1);

  if (!shahbaz) {
    throw new Error(`Xorora employee ${SHAHBAZ_EMPLOYEE_CODE} (Shahbaz Afzal) not found.`);
  }

  const [cl61] = await db
    .select({ id: employees.id, fullName: employees.fullName })
    .from(employees)
    .where(eq(employees.employeeCode, CL61_EMPLOYEE_CODE))
    .limit(1);

  if (!cl61) {
    console.log("CL-61 not found — already merged or never imported.");
    if (shahbaz.machineCardNo !== SHAHBAZ_MACHINE_CARD_NO) {
      await db
        .update(employees)
        .set({ machineCardNo: SHAHBAZ_MACHINE_CARD_NO })
        .where(eq(employees.id, shahbaz.id));
      console.log(`Linked ${shahbaz.fullName} to card ${SHAHBAZ_MACHINE_CARD_NO}.`);
    }
    return;
  }

  const movedAttendance = await db
    .update(attendanceDays)
    .set({ employeeId: shahbaz.id })
    .where(eq(attendanceDays.employeeId, cl61.id))
    .returning({ id: attendanceDays.id });

  const movedPunches = await db
    .update(machinePunches)
    .set({ employeeId: shahbaz.id })
    .where(eq(machinePunches.employeeId, cl61.id))
    .returning({ id: machinePunches.id });

  // Release the card from the duplicate before assigning it to the Xorora employee.
  await db.update(employees).set({ machineCardNo: null }).where(eq(employees.id, cl61.id));

  await db
    .update(employees)
    .set({ machineCardNo: SHAHBAZ_MACHINE_CARD_NO })
    .where(eq(employees.id, shahbaz.id));

  await db.delete(employees).where(eq(employees.id, cl61.id));

  console.log(
    `Merged ${cl61.fullName} (${CL61_EMPLOYEE_CODE}) into ${shahbaz.fullName} (${SHAHBAZ_EMPLOYEE_CODE}).`,
  );
  console.log(`  attendance_days moved: ${movedAttendance.length}`);
  console.log(`  machine_punches moved: ${movedPunches.length}`);
  console.log(`  machine_card_no: ${SHAHBAZ_MACHINE_CARD_NO}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
