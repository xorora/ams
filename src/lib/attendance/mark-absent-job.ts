import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import { getAutoAbsentShiftDateForCompany, getCompanyShiftConfig, isClosedShiftDate } from "./company-shift";
import { shouldAutoMarkAbsent, shouldAutoMarkWeekendOff } from "./mark-absent-eligibility";
import {
  type MarkMissedCheckoutJobResult,
  runMarkMissedCheckoutJob,
} from "./mark-missed-checkout-job";

export type MarkAbsentJobResult = {
  shiftDate: string;
  marked: number;
  skipped: number;
  totalActive: number;
  kind: "absent" | "weekend_off";
  missedCheckout: MarkMissedCheckoutJobResult;
};

const weekendOffRowValues = {
  status: "weekend_off" as const,
  source: "system" as const,
  checkInAt: null,
  checkOutAt: null,
  checkInLat: null,
  checkInLng: null,
  checkOutLat: null,
  checkOutLng: null,
  isLate: false,
  isEarlyLeave: false,
  isMissedCheckout: false,
  totalBreakSeconds: 0,
};

const absentRowValues = {
  status: "absent" as const,
  source: "system" as const,
  checkInAt: null,
  checkOutAt: null,
  checkInLat: null,
  checkInLng: null,
  checkOutLat: null,
  checkOutLng: null,
  isLate: false,
  isEarlyLeave: false,
  isMissedCheckout: false,
  totalBreakSeconds: 0,
};

export async function runMarkAbsentJob(runAt: Date = new Date()): Promise<MarkAbsentJobResult> {
  const missedCheckout = await runMarkMissedCheckoutJob(runAt);
  const now = runAt;

  const activeEmployees = await db
    .select({ id: employees.id, companySlug: companies.slug })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.isActive, true));

  const shiftDateByEmployee = new Map(
    activeEmployees.map(({ id, companySlug }) => [
      id,
      getAutoAbsentShiftDateForCompany(runAt, getCompanyShiftConfig(companySlug)),
    ]),
  );
  const uniqueShiftDates = [...new Set(shiftDateByEmployee.values())];

  const existingDays =
    uniqueShiftDates.length === 0
      ? []
      : await db
          .select({
            id: attendanceDays.id,
            employeeId: attendanceDays.employeeId,
            shiftDate: attendanceDays.shiftDate,
            checkInAt: attendanceDays.checkInAt,
            status: attendanceDays.status,
            source: attendanceDays.source,
          })
          .from(attendanceDays)
          .where(inArray(attendanceDays.shiftDate, uniqueShiftDates));

  const dayByEmployeeAndDate = new Map(
    existingDays.map((day) => [`${day.employeeId}:${day.shiftDate}`, day]),
  );

  let marked = 0;
  let skipped = 0;
  const shiftDates = new Set<string>();
  let markedWeekendOff = 0;
  let markedAbsent = 0;

  for (const { id: employeeId, companySlug } of activeEmployees) {
    const config = getCompanyShiftConfig(companySlug);
    const shiftDate = getAutoAbsentShiftDateForCompany(runAt, config);
    shiftDates.add(shiftDate);
    const isWeekend = isClosedShiftDate(shiftDate, config, companySlug);
    const day = dayByEmployeeAndDate.get(`${employeeId}:${shiftDate}`) ?? null;
    const shouldMark = isWeekend ? shouldAutoMarkWeekendOff(day) : shouldAutoMarkAbsent(day);

    if (!shouldMark) {
      skipped += 1;
      continue;
    }

    const rowValues = isWeekend ? weekendOffRowValues : absentRowValues;

    if (day) {
      await db
        .update(attendanceDays)
        .set({
          ...rowValues,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, day.id));
    } else {
      await db.insert(attendanceDays).values({
        employeeId,
        shiftDate,
        ...rowValues,
      });
    }

    marked += 1;
    if (isWeekend) {
      markedWeekendOff += 1;
    } else {
      markedAbsent += 1;
    }
  }

  return {
    shiftDate: [...shiftDates].sort().join(", ") || "none",
    marked,
    skipped,
    totalActive: activeEmployees.length,
    kind: markedWeekendOff > 0 && markedAbsent === 0 ? "weekend_off" : "absent",
    missedCheckout,
  };
}
