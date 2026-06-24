import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees, machinePunches } from "@/db/schema";
import {
  getCompanyShiftConfig,
  getExpectedCheckOutAt,
  getShiftDateForCompany,
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

type PunchRow = {
  employeeId: string;
  punchAt: Date;
  companySlug: string;
};

type PunchGroup = {
  employeeId: string;
  shiftDate: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  companySlug: string;
};

type AttendanceInsertRow = typeof attendanceDays.$inferInsert;

function groupPunches(rows: PunchRow[]): PunchGroup[] {
  const byKey = new Map<
    string,
    { employeeId: string; shiftDate: string; companySlug: string; punches: Date[] }
  >();

  for (const { employeeId, punchAt, companySlug } of rows) {
    const config = getCompanyShiftConfig(companySlug);
    const shiftDate = getShiftDateForCompany(punchAt, config);
    const key = `${employeeId}:${shiftDate}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.punches.push(punchAt);
    } else {
      byKey.set(key, { employeeId, shiftDate, companySlug, punches: [punchAt] });
    }
  }

  const groups: PunchGroup[] = [];
  for (const { employeeId, shiftDate, companySlug, punches } of byKey.values()) {
    punches.sort((a, b) => a.getTime() - b.getTime());
    const checkInAt = punches[0];
    const checkOutAt = punches.length > 1 ? punches[punches.length - 1] : null;
    groups.push({ employeeId, shiftDate, checkInAt, checkOutAt, companySlug });
  }

  return groups;
}

function buildAttendanceRow(group: PunchGroup): AttendanceInsertRow {
  const config = getCompanyShiftConfig(group.companySlug);
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

async function upsertAttendanceRows(rows: AttendanceInsertRow[]): Promise<number> {
  let affected = 0;

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const result = await db
      .insert(attendanceDays)
      .values(batch)
      .onConflictDoUpdate({
        target: [attendanceDays.employeeId, attendanceDays.shiftDate],
        set: {
          checkInAt: sql`excluded.check_in_at`,
          checkOutAt: sql`excluded.check_out_at`,
          isLate: sql`excluded.is_late`,
          isEarlyLeave: sql`excluded.is_early_leave`,
          overtimeStartedAt: sql`excluded.overtime_started_at`,
          overtimeEndedAt: sql`excluded.overtime_ended_at`,
          overtimeSeconds: sql`excluded.overtime_seconds`,
          updatedAt: sql`now()`,
        },
        where: eq(attendanceDays.source, "system"),
      })
      .returning({ id: attendanceDays.id });

    affected += result.length;
  }

  return affected;
}

/** Attach unlinked punches via machine_card_no or employee_code (ADMS PIN). */
export async function relinkMachinePunchesToEmployees(): Promise<number> {
  const byCard = await db.execute(sql`
    UPDATE machine_punches AS mp
    SET employee_id = e.id
    FROM employees AS e
    WHERE mp.employee_id IS NULL
      AND e.machine_card_no IS NOT NULL
      AND e.machine_card_no = mp.card_no
  `);

  const byCode = await db.execute(sql`
    UPDATE machine_punches AS mp
    SET employee_id = e.id
    FROM employees AS e
    WHERE mp.employee_id IS NULL
      AND mp.machine_emp_code IS NOT NULL
      AND e.employee_code = mp.machine_emp_code
  `);

  return Number(byCard.rowCount ?? 0) + Number(byCode.rowCount ?? 0);
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
      companySlug: companies.slug,
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
          },
        ]
      : [],
  );

  const groups = groupPunches(mappedPunches);
  const attendanceRows = groups.map((group) => buildAttendanceRow(group));
  const inserted = await upsertAttendanceRows(attendanceRows);

  return {
    punchRows: mappedPunches.length,
    groups: groups.length,
    inserted,
    skipped: groups.length - inserted,
  };
}
