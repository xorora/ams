import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees, machinePunches } from "@/db/schema";
import {
  getShiftDateForCompany,
  isEarlyLeaveForCompany,
  isLateCheckInForCompany,
  type CompanyShiftConfig,
} from "./company-shift";
import { loadEmployeeShiftConfig } from "./employee-shift";
import {
  parseMachinePunchDirection,
  relinkMachinePunchesToEmployees,
  runProcessMachinePunchesJob,
} from "./machine-punch-processor";

type PunchDirection = "in" | "out" | "unknown";

function earliestDate(values: Date[]): Date | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((earliest, value) =>
    value.getTime() < earliest.getTime() ? value : earliest,
  );
}

function latestDate(values: Date[]): Date | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((latest, value) => (value.getTime() > latest.getTime() ? value : latest));
}

function resolveUnknownPunches(
  checkIns: Date[],
  checkOuts: Date[],
  unknowns: Date[],
  existing: typeof attendanceDays.$inferSelect | null,
): { checkInAt: Date | null; checkOutAt: Date | null } {
  const ins = [...checkIns];
  const outs = [...checkOuts];

  if (unknowns.length === 0) {
    return { checkInAt: earliestDate(ins), checkOutAt: latestDate(outs) };
  }

  const sortedUnknowns = [...unknowns].sort((a, b) => a.getTime() - b.getTime());

  if (sortedUnknowns.length === 1) {
    const punch = sortedUnknowns[0];
    if (existing?.checkInAt && !existing.checkOutAt) {
      outs.push(punch);
    } else if (!existing?.checkInAt) {
      ins.push(punch);
    } else {
      outs.push(punch);
    }
    return { checkInAt: earliestDate(ins), checkOutAt: latestDate(outs) };
  }

  ins.push(sortedUnknowns[0]);
  outs.push(sortedUnknowns[sortedUnknowns.length - 1]);
  return { checkInAt: earliestDate(ins), checkOutAt: latestDate(outs) };
}

function deriveTimesFromPunches(
  punches: { punchAt: Date; direction: PunchDirection }[],
  existing: typeof attendanceDays.$inferSelect | null,
): { checkInAt: Date | null; checkOutAt: Date | null } {
  const checkIns: Date[] = [];
  const checkOuts: Date[] = [];
  const unknowns: Date[] = [];

  for (const punch of punches) {
    if (punch.direction === "in") {
      checkIns.push(punch.punchAt);
    } else if (punch.direction === "out") {
      checkOuts.push(punch.punchAt);
    } else {
      unknowns.push(punch.punchAt);
    }
  }

  return resolveUnknownPunches(checkIns, checkOuts, unknowns, existing);
}

async function loadPunchesForEmployee(employeeId: string): Promise<
  { punchAt: Date; rawPunchAt: string | null }[]
> {
  const [employee] = await db
    .select({ employeeCode: employees.employeeCode })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return [];
  }

  const codeVariants = [
    employee.employeeCode,
    employee.employeeCode.replace(/^0+/, "") || "0",
    employee.employeeCode.padStart(3, "0"),
  ];

  return await db
    .select({
      punchAt: machinePunches.punchAt,
      rawPunchAt: machinePunches.rawPunchAt,
    })
    .from(machinePunches)
    .where(
      or(
        eq(machinePunches.employeeId, employeeId),
        and(
          isNull(machinePunches.employeeId),
          inArray(machinePunches.machineEmpCode, [...new Set(codeVariants)]),
        ),
      ),
    );
}

async function backfillShiftRowFromPunches(
  employeeId: string,
  shiftDate: string,
  shiftConfig: CompanyShiftConfig,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.shiftDate, shiftDate)))
    .limit(1);

  const punches = await loadPunchesForEmployee(employeeId);

  const shiftPunches = punches
    .map((punch) => ({
      punchAt: punch.punchAt,
      direction: parseMachinePunchDirection(punch.rawPunchAt),
    }))
    .filter((punch) => getShiftDateForCompany(punch.punchAt, shiftConfig) === shiftDate);

  if (shiftPunches.length === 0) {
    return false;
  }

  const { checkInAt, checkOutAt } = deriveTimesFromPunches(shiftPunches, existing ?? null);
  if (!checkInAt && !checkOutAt) {
    return false;
  }

  const isLate = checkInAt ? isLateCheckInForCompany(checkInAt, shiftDate, shiftConfig) : false;
  const isEarlyLeave = checkOutAt
    ? isEarlyLeaveForCompany(checkOutAt, shiftDate, shiftConfig)
    : false;

  if (existing) {
    const needsUpdate =
      (checkInAt && !existing.checkInAt) ||
      (checkOutAt && !existing.checkOutAt) ||
      (existing.status !== "present" && existing.status !== "leave" && checkInAt != null);

    if (!needsUpdate) {
      return false;
    }

    await db
      .update(attendanceDays)
      .set({
        status: "present",
        source: existing.source === "manual" ? existing.source : "system",
        checkInAt: existing.checkInAt ?? checkInAt,
        checkOutAt: existing.checkOutAt ?? checkOutAt,
        isLate: existing.checkInAt ? existing.isLate : isLate,
        isEarlyLeave: existing.checkOutAt ? existing.isEarlyLeave : isEarlyLeave,
        isMissedCheckout: checkOutAt ? false : existing.isMissedCheckout,
        updatedAt: new Date(),
      })
      .where(eq(attendanceDays.id, existing.id));

    return true;
  }

  await db.insert(attendanceDays).values({
    employeeId,
    shiftDate,
    status: "present",
    source: "system",
    checkInAt,
    checkOutAt,
    isLate,
    isEarlyLeave,
    isMissedCheckout: false,
    totalBreakSeconds: 0,
  });

  return true;
}

/**
 * Aligns the employee dashboard with the attendance log by reprocessing device
 * punches and backfilling check-in / check-out times on the current shift row.
 */
export async function reconcileEmployeeAttendanceFromLog(
  employeeId: string,
  now: Date = new Date(),
): Promise<void> {
  await relinkMachinePunchesToEmployees();

  const shiftConfig = await loadEmployeeShiftConfig(employeeId);
  const shiftDate = getShiftDateForCompany(now, shiftConfig);

  await runProcessMachinePunchesJob({ employeeIds: [employeeId] });

  const punches = await loadPunchesForEmployee(employeeId);
  const shiftDates = new Set<string>([shiftDate]);
  for (const punch of punches) {
    shiftDates.add(getShiftDateForCompany(punch.punchAt, shiftConfig));
  }

  for (const date of [...shiftDates].sort()) {
    await backfillShiftRowFromPunches(employeeId, date, shiftConfig);
  }
}

/** Reconcile attendance log check-ins for many employees (e.g. after a device pull). */
export async function reconcileAttendanceFromLogForEmployees(
  employeeIds: string[],
  now: Date = new Date(),
  options: { skipPunchJob?: boolean } = {},
): Promise<number> {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return 0;
  }

  if (!options.skipPunchJob) {
    await relinkMachinePunchesToEmployees();
    await runProcessMachinePunchesJob({ employeeIds: uniqueIds });
  }

  let updated = 0;
  for (const employeeId of uniqueIds) {
    const shiftConfig = await loadEmployeeShiftConfig(employeeId);
    const shiftDate = getShiftDateForCompany(now, shiftConfig);
    const changed = await backfillShiftRowFromPunches(employeeId, shiftDate, shiftConfig);
    if (changed) {
      updated += 1;
    }
  }

  return updated;
}
