import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";

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

  const { db } = await import("../src/db");
  const { employees } = await import("../src/db/schema");
  const { recalcEmployeeLateFlags } = await import("../src/lib/admin/recalc-employee-late-flags");
  const { BUSINESS_TIMEZONE } = await import("../src/lib/attendance/constants");

  const email = (process.argv[2] ?? "cl-03@crestled.com").trim().toLowerCase();
  const [employee] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      email: employees.email,
      shiftPreset: employees.shiftPreset,
    })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  if (!employee) {
    throw new Error(`Employee not found: ${email}`);
  }

  console.log("Before:", employee);

  await db
    .update(employees)
    .set({ shiftPreset: "evening", updatedAt: new Date() })
    .where(eq(employees.id, employee.id));

  const year = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy");
  const result = await recalcEmployeeLateFlags({
    employeeId: employee.id,
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });

  console.log("Set shift_preset=evening for", employee.fullName, employee.email);
  console.log(
    `Recalc ${year}: updated=${result.updated} cleared=${result.cleared} marked=${result.marked}`,
  );
  for (const row of result.rows.slice(0, 30)) {
    console.log(
      `  ${row.shiftDate} ${row.checkInPkt}: late ${row.wasLate} -> ${row.nowLate}`,
    );
  }
  if (result.rows.length > 30) {
    console.log(`  …and ${result.rows.length - 30} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
