import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees, machinePunches } from "@/db/schema";
import {
  getShiftDateForCompany,
  getShiftConfigForEmployee,
  isEarlyLeaveForCompany,
  isLateCheckInForCompany,
} from "./company-shift";

const INSERT_BATCH_SIZE = 100;

export type ProcessMachinePunchesOptions = {
  /** Only punches at or after this instant (UTC). */
  since?: Date;
  /** Only punches at or before this instant (UTC). */
  until?: Date;
  /** Only punches linked to these employees (includes full shift-day history per employee). */
  employeeIds?: string[];
};

export type ProcessMachinePunchesResult = {
  punchRows: number;
  groups: number;
  inserted: number;
  skipped: number;
};

type PunchDirection = "in" | "out" | "unknown";

type PunchRow = {
  employeeId: string;
  punchAt: Date;
  companySlug: string;
  fullName: string;
  shiftPreset: string | null;
  direction: PunchDirection;
};

type ShiftPunchGroup = {
  employeeId: string;
  shiftDate: string;
  companySlug: string;
  fullName: string;
  shiftPreset: string | null;
  checkIns: Date[];
  checkOuts: Date[];
  unknowns: Date[];
};

type ExistingAttendance = typeof attendanceDays.$inferSelect;

type AttendanceUpsertRow = {
  employeeId: string;
  shiftDate: string;
  status: "present";
  source: "system";
  checkInAt: Date | null;
  checkOutAt: Date | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  isMissedCheckout: boolean;
  totalBreakSeconds: number;
};

export function parseMachinePunchDirection(rawPunchAt: string | null): PunchDirection {
  if (!rawPunchAt) {
    return "unknown";
  }

  const parts = rawPunchAt.split("|");
  if (parts.length < 2) {
    return "unknown";
  }

  const state = parts[1].trim().toLowerCase();
  if (state.includes("check out") || state === "checkout") {
    return "out";
  }
  if (state.includes("check in") || state === "checkin") {
    return "in";
  }

  return "unknown";
}

function groupPunches(rows: PunchRow[]): ShiftPunchGroup[] {
  const byKey = new Map<string, ShiftPunchGroup>();

  for (const { employeeId, punchAt, companySlug, fullName, shiftPreset, direction } of rows) {
    const config = getShiftConfigForEmployee(companySlug, shiftPreset, fullName);
    const shiftDate = getShiftDateForCompany(punchAt, config);
    const key = `${employeeId}:${shiftDate}`;
    const existing =
      byKey.get(key) ??
      ({
        employeeId,
        shiftDate,
        companySlug,
        fullName,
        shiftPreset,
        checkIns: [],
        checkOuts: [],
        unknowns: [],
      } satisfies ShiftPunchGroup);

    if (direction === "in") {
      existing.checkIns.push(punchAt);
    } else if (direction === "out") {
      existing.checkOuts.push(punchAt);
    } else {
      existing.unknowns.push(punchAt);
    }

    byKey.set(key, existing);
  }

  return [...byKey.values()];
}

function resolveUnknownPunches(
  group: ShiftPunchGroup,
  existing: ExistingAttendance | null,
): { checkIns: Date[]; checkOuts: Date[] } {
  const checkIns = [...group.checkIns];
  const checkOuts = [...group.checkOuts];

  if (group.unknowns.length === 0) {
    return { checkIns, checkOuts };
  }

  const unknowns = [...group.unknowns].sort((a, b) => a.getTime() - b.getTime());

  if (unknowns.length === 1) {
    const punch = unknowns[0];
    if (existing?.checkInAt && !existing.checkOutAt) {
      checkOuts.push(punch);
    } else if (!existing?.checkInAt) {
      checkIns.push(punch);
    } else {
      checkOuts.push(punch);
    }
    return { checkIns, checkOuts };
  }

  checkIns.push(unknowns[0]);
  checkOuts.push(unknowns[unknowns.length - 1]);
  return { checkIns, checkOuts };
}

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

function mergeCheckIn(existing: Date | null, machineValues: Date[]): Date | null {
  const machineEarliest = earliestDate(machineValues);
  if (!machineEarliest) {
    return existing;
  }
  if (!existing) {
    return machineEarliest;
  }
  return existing.getTime() <= machineEarliest.getTime() ? existing : machineEarliest;
}

function mergeCheckOut(existing: Date | null, machineValues: Date[]): Date | null {
  const machineLatest = latestDate(machineValues);
  if (!machineLatest) {
    return existing;
  }
  if (!existing) {
    return machineLatest;
  }
  return existing.getTime() >= machineLatest.getTime() ? existing : machineLatest;
}

function buildMergedAttendanceRow(
  group: ShiftPunchGroup,
  existing: ExistingAttendance | null,
): AttendanceUpsertRow | null {
  const { checkIns, checkOuts } = resolveUnknownPunches(group, existing);
  const checkInAt = mergeCheckIn(existing?.checkInAt ?? null, checkIns);
  const checkOutAt = mergeCheckOut(existing?.checkOutAt ?? null, checkOuts);

  if (!checkInAt && !checkOutAt) {
    return null;
  }

  const config = getShiftConfigForEmployee(group.companySlug, group.shiftPreset, group.fullName);
  const isLate = checkInAt ? isLateCheckInForCompany(checkInAt, group.shiftDate, config) : false;
  const isEarlyLeave = checkOutAt
    ? isEarlyLeaveForCompany(checkOutAt, group.shiftDate, config)
    : false;

  return {
    employeeId: group.employeeId,
    shiftDate: group.shiftDate,
    status: "present",
    source: "system",
    checkInAt,
    checkOutAt,
    isLate,
    isEarlyLeave,
    isMissedCheckout: checkOutAt ? false : (existing?.isMissedCheckout ?? false),
    totalBreakSeconds: existing?.totalBreakSeconds ?? 0,
  };
}

async function upsertAttendanceRows(
  rows: AttendanceUpsertRow[],
  existingByKey: Map<string, ExistingAttendance>,
): Promise<number> {
  let affected = 0;

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);

    for (const row of batch) {
      const key = `${row.employeeId}:${row.shiftDate}`;
      const existing = existingByKey.get(key);

      if (existing) {
        const result = await db
          .update(attendanceDays)
          .set({
            status: row.status,
            checkInAt: row.checkInAt,
            checkOutAt: row.checkOutAt,
            isLate: row.isLate,
            isEarlyLeave: row.isEarlyLeave,
            isMissedCheckout: row.isMissedCheckout,
            updatedAt: sql`now()`,
          })
          .where(eq(attendanceDays.id, existing.id))
          .returning({ id: attendanceDays.id });

        affected += result.length;
        continue;
      }

      const result = await db
        .insert(attendanceDays)
        .values({
          employeeId: row.employeeId,
          shiftDate: row.shiftDate,
          status: row.status,
          source: row.source,
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
          checkInLat: null,
          checkInLng: null,
          checkOutLat: null,
          checkOutLng: null,
          isLate: row.isLate,
          isEarlyLeave: row.isEarlyLeave,
          isMissedCheckout: row.isMissedCheckout,
          totalBreakSeconds: row.totalBreakSeconds,
        })
        .returning({ id: attendanceDays.id });

      affected += result.length;
    }
  }

  return affected;
}

/** Attach unlinked punches via employee_code (device badge number). */
export async function relinkMachinePunchesToEmployees(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE machine_punches AS mp
    SET employee_id = e.id
    FROM employees AS e
    WHERE mp.employee_id IS NULL
      AND mp.machine_emp_code IS NOT NULL
      AND (
        e.employee_code = mp.machine_emp_code
        OR ltrim(e.employee_code, '0') = ltrim(mp.machine_emp_code, '0')
      )
  `);

  return Number(result.rowCount ?? 0);
}

export async function runProcessMachinePunchesJob(
  options: ProcessMachinePunchesOptions = {},
): Promise<ProcessMachinePunchesResult> {
  const conditions = [isNotNull(machinePunches.employeeId)];
  if (options.since) {
    conditions.push(gte(machinePunches.punchAt, options.since));
  }
  if (options.until) {
    conditions.push(lte(machinePunches.punchAt, options.until));
  }
  if (options.employeeIds && options.employeeIds.length > 0) {
    conditions.push(inArray(machinePunches.employeeId, options.employeeIds));
  }

  const punchRows = await db
    .select({
      employeeId: machinePunches.employeeId,
      punchAt: machinePunches.punchAt,
      rawPunchAt: machinePunches.rawPunchAt,
      companySlug: companies.slug,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
    })
    .from(machinePunches)
    .innerJoin(employees, eq(machinePunches.employeeId, employees.id))
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(and(...conditions));

  const mappedPunches = punchRows.flatMap((row) =>
    row.employeeId
      ? [
          {
            employeeId: row.employeeId,
            punchAt: row.punchAt,
            companySlug: row.companySlug,
            fullName: row.fullName,
            shiftPreset: row.shiftPreset,
            direction: parseMachinePunchDirection(row.rawPunchAt),
          },
        ]
      : [],
  );

  const groups = groupPunches(mappedPunches);
  if (groups.length === 0) {
    return {
      punchRows: mappedPunches.length,
      groups: 0,
      inserted: 0,
      skipped: 0,
    };
  }

  const employeeIds = [...new Set(groups.map((group) => group.employeeId))];
  const shiftDates = [...new Set(groups.map((group) => group.shiftDate))];

  const existingRows = await db
    .select()
    .from(attendanceDays)
    .where(
      and(
        inArray(attendanceDays.employeeId, employeeIds),
        inArray(attendanceDays.shiftDate, shiftDates),
      ),
    );

  const existingByKey = new Map(
    existingRows.map((row) => [`${row.employeeId}:${row.shiftDate}`, row]),
  );

  const attendanceRows = groups.flatMap((group) => {
    const existing = existingByKey.get(`${group.employeeId}:${group.shiftDate}`) ?? null;
    const merged = buildMergedAttendanceRow(group, existing);
    return merged ? [merged] : [];
  });

  const inserted = await upsertAttendanceRows(attendanceRows, existingByKey);

  return {
    punchRows: mappedPunches.length,
    groups: groups.length,
    inserted,
    skipped: groups.length - attendanceRows.length,
  };
}
