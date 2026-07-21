import { and, eq, ne, or, isNull } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { recalcEmployeeLateFlags } from "@/lib/admin/recalc-employee-late-flags";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

/** Crest LED staff who work the 6pm–3am evening shift. */
const CREST_EVENING_SHIFT_EMAILS = ["cl-03@crestled.com"] as const;

/**
 * Idempotent: set known Crest evening staff to `evening` and recalculate
 * late flags for the current calendar year when a change is applied.
 */
export async function ensureCrestEveningShiftEmployees(): Promise<void> {
  for (const email of CREST_EVENING_SHIFT_EMAILS) {
    const [employee] = await db
      .select({ id: employees.id, shiftPreset: employees.shiftPreset })
      .from(employees)
      .where(eq(employees.email, email))
      .limit(1);

    if (!employee || employee.shiftPreset === "evening") {
      continue;
    }

    await db
      .update(employees)
      .set({ shiftPreset: "evening", updatedAt: new Date() })
      .where(
        and(
          eq(employees.id, employee.id),
          or(isNull(employees.shiftPreset), ne(employees.shiftPreset, "evening")),
        ),
      );

    const year = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy");
    await recalcEmployeeLateFlags({
      employeeId: employee.id,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    });
  }
}
