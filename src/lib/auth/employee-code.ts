import { sql } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";

export function normalizeEmployeeCode(employeeCode: string): string {
  return employeeCode.trim();
}

export async function findEmployeeByCode(
  employeeCode: string,
): Promise<typeof employees.$inferSelect | null> {
  const code = normalizeEmployeeCode(employeeCode);
  if (!code) {
    return null;
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(sql`lower(${employees.employeeCode}) = ${code.toLowerCase()}`)
    .limit(1);

  return employee ?? null;
}

function reserveUniqueCode(baseCode: string, taken: Set<string>): string {
  if (!taken.has(baseCode.toLowerCase())) {
    return baseCode;
  }

  let suffix = 2;
  while (taken.has(`${baseCode}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${baseCode}-${suffix}`;
}

/** Assigns the next available zero-padded numeric code, with suffix fallback on collision. */
export async function generateUniqueEmployeeCode(): Promise<string> {
  const rows = await db.select({ employeeCode: employees.employeeCode }).from(employees);
  const taken = new Set(rows.map((row) => row.employeeCode.toLowerCase()));

  let maxNumeric = 0;
  for (const row of rows) {
    const normalized = row.employeeCode.trim();
    if (/^\d+$/.test(normalized)) {
      maxNumeric = Math.max(maxNumeric, Number.parseInt(normalized, 10));
    }
  }

  const base = String(maxNumeric + 1).padStart(3, "0");
  return reserveUniqueCode(base, taken);
}
