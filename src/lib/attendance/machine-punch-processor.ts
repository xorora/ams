import { and, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, machinePunches } from "@/db/schema";
import {
  COMPANY_SHIFT_BY_SLUG,
  type CompanyShiftConfig,
  getExpectedCheckOutAt,
  getShiftDateForCompany,
  isEarlyLeaveForCompany,
  isLateCheckInForCompany,
} from "./company-shift";

/** Crest LED machine punches use the 9 AM–5 PM day shift (15 min grace). */
const MACHINE_PUNCH_SHIFT = COMPANY_SHIFT_BY_SLUG["crest-led"];

const INSERT_BATCH_SIZE = 100;

export type ProcessMachinePunchesOptions = {
  /** Only punches at or after this instant (UTC). */
  since?: Date;
  /** Only punches at or before this instant (UTC). */
  until?: Date;
};

export type ProcessMachinePunchesResult = {
  punchRows: number;
  groups: number;
  inserted: number;
  skipped: number;
};

type PunchGroup = {
  employeeId: string;
  shiftDate: string;
  checkInAt: Date;
  checkOutAt: Date | null;
};

type AttendanceInsertRow = typeof attendanceDays.$inferInsert;

function groupPunches(
  rows: { employeeId: string; punchAt: Date }[],
  config: CompanyShiftConfig,
): PunchGroup[] {
  const byKey = new Map<string, { employeeId: string; shiftDate: string; punches: Date[] }>();

  for (const { employeeId, punchAt } of rows) {
    const shiftDate = getShiftDateForCompany(punchAt, config);
    const key = `${employeeId}:${shiftDate}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.punches.push(punchAt);
    } else {
      byKey.set(key, { employeeId, shiftDate, punches: [punchAt] });
    }
  }

  const groups: PunchGroup[] = [];
  for (const { employeeId, shiftDate, punches } of byKey.values()) {
    punches.sort((a, b) => a.getTime() - b.getTime());
    const checkInAt = punches[0];
    const checkOutAt = punches.length > 1 ? punches[punches.length - 1] : null;
    groups.push({ employeeId, shiftDate, checkInAt, checkOutAt });
  }

  return groups;
}

function buildAttendanceRow(group: PunchGroup, config: CompanyShiftConfig): AttendanceInsertRow {
  const { employeeId, shiftDate, checkInAt, checkOutAt } = group;
  const isLate = isLateCheckInForCompany(checkInAt, shiftDate, config);
  const isEarlyLeave = checkOutAt ? isEarlyLeaveForCompany(checkOutAt, shiftDate, config) : false;

  let overtimeStartedAt: Date | null = null;
  let overtimeEndedAt: Date | null = null;
  let overtimeSeconds: number | null = null;

  if (checkOutAt) {
    const expectedCheckout = getExpectedCheckOutAt(shiftDate, config);
    if (checkOutAt.getTime() > expectedCheckout.getTime()) {
      overtimeStartedAt = expectedCheckout;
      overtimeEndedAt = checkOutAt;
      overtimeSeconds = Math.max(
        0,
        Math.floor((checkOutAt.getTime() - expectedCheckout.getTime()) / 1000),
      );
    }
  }

  return {
    employeeId,
    shiftDate,
    status: "present",
    source: "system",
    checkInAt,
    checkOutAt,
    checkInLat: null,
    checkInLng: null,
    checkOutLat: null,
    checkOutLng: null,
    isLate,
    isEarlyLeave,
    overtimeStartedAt,
    overtimeEndedAt,
    overtimeSeconds,
    totalBreakSeconds: 0,
  };
}

async function insertAttendanceRows(rows: AttendanceInsertRow[]): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const created = await db
      .insert(attendanceDays)
      .values(batch)
      .onConflictDoNothing({
        target: [attendanceDays.employeeId, attendanceDays.shiftDate],
      })
      .returning({ id: attendanceDays.id });

    inserted += created.length;
  }

  return inserted;
}

/** Attach unlinked punches to employees via employees.machine_card_no = machine_punches.card_no. */
export async function relinkMachinePunchesToEmployees(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE machine_punches AS mp
    SET employee_id = e.id
    FROM employees AS e
    WHERE mp.employee_id IS NULL
      AND e.machine_card_no IS NOT NULL
      AND e.machine_card_no = mp.card_no
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

  const punchRows = await db
    .select({
      employeeId: machinePunches.employeeId,
      punchAt: machinePunches.punchAt,
    })
    .from(machinePunches)
    .where(and(...conditions));

  const mappedPunches = punchRows.flatMap((row) =>
    row.employeeId ? [{ employeeId: row.employeeId, punchAt: row.punchAt }] : [],
  );

  const groups = groupPunches(mappedPunches, MACHINE_PUNCH_SHIFT);
  const attendanceRows = groups.map((group) => buildAttendanceRow(group, MACHINE_PUNCH_SHIFT));
  const inserted = await insertAttendanceRows(attendanceRows);

  return {
    punchRows: mappedPunches.length,
    groups: groups.length,
    inserted,
    skipped: groups.length - inserted,
  };
}
