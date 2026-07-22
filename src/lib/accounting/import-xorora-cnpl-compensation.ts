import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, employeeCompensation, employees } from "@/db/schema";
import { getSyncStateValue, setSyncStateValue } from "@/lib/zktime/sync-state";

export const XORORA_CNPL_COMPENSATION_IMPORT_KEY = "xorora_cnpl_compensation_import_v1";

export type CnplCompensationRow = {
  name: string;
  aliases?: string[];
  grossSalaryPkr: number;
  basicSalaryPkr: number;
  conveyanceAllowancePkr: number;
};

/** CNPL sheet values from Salary Sheet.xlsx (Creative Nexis / Xorora). */
export const XORORA_CNPL_COMPENSATION_ROWS: CnplCompensationRow[] = [
  {
    name: "Zarrar Ahmed",
    aliases: ["Zarrar Ahmad"],
    grossSalaryPkr: 130_000,
    basicSalaryPkr: 48_100,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Mr. Shahbaz",
    aliases: ["Shahbaz", "Mr Shahbaz", "Shahbaz Afzal"],
    grossSalaryPkr: 135_000,
    basicSalaryPkr: 49_950,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Hassam Shoaib",
    grossSalaryPkr: 160_000,
    basicSalaryPkr: 59_200,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Danial Zafar",
    aliases: ["Daniel Zafar", "Daniyal Zafar"],
    grossSalaryPkr: 160_000,
    basicSalaryPkr: 59_200,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Sadia Saif",
    grossSalaryPkr: 85_000,
    basicSalaryPkr: 31_450,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Rida Zainab",
    grossSalaryPkr: 50_000,
    basicSalaryPkr: 18_500,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Muhammad Bilal Khan",
    aliases: ["Bilal Khan", "M Bilal Khan"],
    grossSalaryPkr: 320_000,
    basicSalaryPkr: 118_400,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Muhammad Abdullah",
    aliases: ["M Abdullah"],
    grossSalaryPkr: 135_000,
    basicSalaryPkr: 49_950,
    conveyanceAllowancePkr: 0,
  },
  {
    name: "Mumtaz",
    aliases: ["Mumtaz "],
    grossSalaryPkr: 40_000,
    basicSalaryPkr: 14_800,
    conveyanceAllowancePkr: 0,
  },
];

export function normalizeCompensationName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^mr\.?\s+/, "");
}

let structureEnsured = false;

/** Apply Excel-structure columns if drizzle migrate has not been run yet. */
export async function ensureCompensationStructureColumns(): Promise<void> {
  if (structureEnsured) {
    return;
  }

  await db.execute(sql`
    ALTER TABLE employee_compensation
    ADD COLUMN IF NOT EXISTS basic_salary_pkr integer DEFAULT 0 NOT NULL
  `);
  await db.execute(sql`
    ALTER TABLE employee_compensation
    ADD COLUMN IF NOT EXISTS conveyance_allowance_pkr integer DEFAULT 0 NOT NULL
  `);
  structureEnsured = true;
}

export type ImportXororaCnplResult = {
  companyName: string;
  matched: string[];
  unmatched: string[];
  updated: number;
  inserted: number;
};

export async function importXororaCnplCompensation(): Promise<ImportXororaCnplResult> {
  await ensureCompensationStructureColumns();

  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  if (!company) {
    throw new Error("Company with slug 'xorora' not found");
  }

  const employeeRows = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      isActive: employees.isActive,
    })
    .from(employees)
    .where(eq(employees.companyId, company.id));

  // Prefer active rows when duplicate names exist (legacy inactive codes).
  const byNormalizedName = new Map<string, (typeof employeeRows)[number]>();
  const sorted = [...employeeRows].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  for (const employee of sorted) {
    const key = normalizeCompensationName(employee.fullName);
    if (!byNormalizedName.has(key)) {
      byNormalizedName.set(key, employee);
    }
  }

  const matched: string[] = [];
  const unmatched: string[] = [];
  let updated = 0;
  let inserted = 0;
  const now = new Date();

  for (const row of XORORA_CNPL_COMPENSATION_ROWS) {
    const candidates = [row.name, ...(row.aliases ?? [])].map(normalizeCompensationName);
    let employee: (typeof employeeRows)[number] | undefined;
    for (const candidate of candidates) {
      employee = byNormalizedName.get(candidate);
      if (employee) {
        break;
      }
    }

    if (!employee) {
      unmatched.push(row.name);
      continue;
    }

    matched.push(`${employee.fullName} (${employee.employeeCode})`);

    const [existing] = await db
      .select({ id: employeeCompensation.id })
      .from(employeeCompensation)
      .where(eq(employeeCompensation.employeeId, employee.id))
      .limit(1);

    if (existing) {
      await db
        .update(employeeCompensation)
        .set({
          grossSalaryPkr: row.grossSalaryPkr,
          basicSalaryPkr: row.basicSalaryPkr,
          conveyanceAllowancePkr: row.conveyanceAllowancePkr,
          updatedAt: now,
        })
        .where(eq(employeeCompensation.employeeId, employee.id));
      updated += 1;
    } else {
      await db.insert(employeeCompensation).values({
        employeeId: employee.id,
        grossSalaryPkr: row.grossSalaryPkr,
        basicSalaryPkr: row.basicSalaryPkr,
        conveyanceAllowancePkr: row.conveyanceAllowancePkr,
        bankName: null,
        bankAccountNumber: null,
        fixedSecurityDeductionPkr: 0,
        fixedOtherPayPkr: 0,
        updatedAt: now,
      });
      inserted += 1;
    }
  }

  return {
    companyName: company.name,
    matched,
    unmatched,
    updated,
    inserted,
  };
}

/** One-time import when Xorora compensation is first opened after deploy. */
export async function maybeImportXororaCnplCompensationOnce(
  companyId: string,
): Promise<ImportXororaCnplResult | null> {
  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company || company.slug !== "xorora") {
    return null;
  }

  const alreadyImported = await getSyncStateValue(XORORA_CNPL_COMPENSATION_IMPORT_KEY);
  if (alreadyImported) {
    return null;
  }

  const result = await importXororaCnplCompensation();
  await setSyncStateValue(XORORA_CNPL_COMPENSATION_IMPORT_KEY, new Date().toISOString());
  return result;
}
