import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
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

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

type MasterEmployeeRow = {
  empName: string;
  empCode: string;
  cardNo: string;
  isActive: boolean;
};

function parseEmployeesMasterCsv(path: string): MasterEmployeeRow[] {
  const content = readFileSync(path, "utf8").trim();
  const lines = content.split("\n");
  if (lines.length < 2) {
    throw new Error(`Expected header and data rows in ${path}.`);
  }

  const header = parseCsvLine(lines[0] ?? "");
  const empNameIndex = header.indexOf("EmpName");
  const empCodeIndex = header.indexOf("EmpCode");
  const cardNoIndex = header.indexOf("CardNo");
  const activeIndex = header.indexOf("active");

  if (empNameIndex === -1 || empCodeIndex === -1 || cardNoIndex === -1 || activeIndex === -1) {
    throw new Error(`Missing required columns in ${path}.`);
  }

  const rows: MasterEmployeeRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }

    const fields = parseCsvLine(line);
    const empName = fields[empNameIndex]?.trim();
    const empCode = fields[empCodeIndex]?.trim();
    const cardNo = fields[cardNoIndex]?.trim();
    const activeRaw = fields[activeIndex]?.trim();

    if (!empName || !empCode || !cardNo) {
      continue;
    }

    rows.push({
      empName,
      empCode,
      cardNo,
      isActive: activeRaw === "1",
    });
  }

  return rows;
}

loadEnvFiles([".env", ".env.local"]);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Set it in .env.local.");
}

const db = drizzle(neon(databaseUrl));

const CREST_LED_SLUG = "crest-led";
/** Cards linked to existing Xorora employees — do not create Crest LED duplicates. */
const SKIP_MACHINE_CARD_NOS = new Set(["00000072", "00000061"]);
const CSV_PATH = resolve(process.cwd(), "exports/employees_master.csv");

function crestLedEmployeeCode(empCode: string): string {
  return `CL-${empCode}`;
}

function crestLedEmail(empCode: string): string {
  return `cl-${empCode.toLowerCase()}@crestled.local`;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const [crestLed] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, CREST_LED_SLUG))
    .limit(1);

  if (!crestLed) {
    throw new Error(
      `Company with slug "${CREST_LED_SLUG}" was not found. Run "bun run db:seed-companies" first.`,
    );
  }

  const sourceRows = parseEmployeesMasterCsv(CSV_PATH);
  const importRows = sourceRows.filter((row) => !SKIP_MACHINE_CARD_NOS.has(row.cardNo));

  if (sourceRows.length !== 16) {
    console.warn(`Expected 16 source rows, found ${sourceRows.length}.`);
  }

  if (importRows.length !== 14) {
    console.warn(
      `Expected 14 import rows (excluding zarrar + shahbaz), found ${importRows.length}.`,
    );
  }

  let created = 0;
  let skipped = 0;

  for (const row of importRows) {
    const [existing] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.machineCardNo, row.cardNo))
      .limit(1);

    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(employees).values({
      employeeCode: crestLedEmployeeCode(row.empCode),
      fullName: row.empName,
      email: crestLedEmail(row.empCode),
      machineCardNo: row.cardNo,
      companyId: crestLed.id,
      isActive: row.isActive,
    });

    created += 1;
    console.log(
      `Created ${row.empName} (${crestLedEmployeeCode(row.empCode)}, card ${row.cardNo}).`,
    );
  }

  const [{ count: crestLedEmployeeCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.companyId, crestLed.id));

  console.log(
    `Done. created=${created}, skipped=${skipped}, crest_led_employees=${crestLedEmployeeCount}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
