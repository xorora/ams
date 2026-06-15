import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { companies, employees } from "../src/db/schema";

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

const ZARRAR_EMPLOYEE_CODE = "002";
const ZARRAR_MACHINE_CARD_NO = "00000072";
const SHAHBAZ_EMPLOYEE_CODE = "001";
const SHAHBAZ_MACHINE_CARD_NO = "00000061";

async function linkXororaEmployeeToMachineCard(
  employeeCode: string,
  machineCardNo: string,
  displayName: string,
): Promise<void> {
  const [employee] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      machineCardNo: employees.machineCardNo,
    })
    .from(employees)
    .where(eq(employees.employeeCode, employeeCode))
    .limit(1);

  if (!employee) {
    throw new Error(`Employee with code ${employeeCode} (${displayName}) was not found.`);
  }

  if (employee.machineCardNo !== machineCardNo) {
    await db.update(employees).set({ machineCardNo }).where(eq(employees.id, employee.id));
    console.log(`Linked ${employee.fullName} (${employeeCode}) to machine card ${machineCardNo}.`);
  } else {
    console.log(`${employee.fullName} already linked to machine card ${machineCardNo}.`);
  }
}

async function ensureCompany(name: string, slug: string) {
  const existing = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db.insert(companies).values({ name, slug }).returning();
  if (!created) {
    throw new Error(`Failed to create company: ${name}`);
  }
  return created;
}

async function isCompanyIdNotNull(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'company_id'
  `);

  const row = result.rows[0] as { is_nullable: string } | undefined;
  return row?.is_nullable === "NO";
}

async function main() {
  const xorora = await ensureCompany("Xorora", "xorora");
  const crestLed = await ensureCompany("Crest LED", "crest-led");

  console.log(`Xorora company id: ${xorora.id}`);
  console.log(`Crest LED company id: ${crestLed.id}`);

  const backfilled = await db
    .update(employees)
    .set({ companyId: xorora.id })
    .where(isNull(employees.companyId))
    .returning({ id: employees.id });

  console.log(`Backfilled ${backfilled.length} employee(s) to Xorora.`);

  await linkXororaEmployeeToMachineCard(
    ZARRAR_EMPLOYEE_CODE,
    ZARRAR_MACHINE_CARD_NO,
    "Zarrar Ahmad",
  );
  await linkXororaEmployeeToMachineCard(
    SHAHBAZ_EMPLOYEE_CODE,
    SHAHBAZ_MACHINE_CARD_NO,
    "Shahbaz Afzal",
  );

  const nullCompanyRows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(isNull(employees.companyId))
    .limit(1);

  if (nullCompanyRows.length > 0) {
    throw new Error("Cannot set company_id NOT NULL: some employees still have a null company_id.");
  }

  if (await isCompanyIdNotNull()) {
    console.log("employees.company_id is already NOT NULL.");
  } else {
    await db.execute(sql`ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL`);
    console.log("Set employees.company_id to NOT NULL.");
  }

  const [{ count: companyCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companies);
  const [{ count: xororaEmployeeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.companyId, xorora.id));

  console.log(`Done. companies=${companyCount}, xorora_employees=${xororaEmployeeCount}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
