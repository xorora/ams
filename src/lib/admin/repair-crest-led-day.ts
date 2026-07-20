import { and, eq, gte, lte, sql } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees, machinePunches } from "@/db/schema";
import { reconcileAttendanceFromLogForEmployees } from "@/lib/attendance/attendance-log-sync";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { effectiveAttendanceStatus } from "@/lib/attendance/effective-status";
import {
  relinkMachinePunchesToEmployees,
  runProcessMachinePunchesJob,
} from "@/lib/attendance/machine-punch-processor";
import { syncAttendanceFromZktime } from "@/lib/zktime/attendance-sync";
import { ZktimeClient } from "@/lib/zktime/client";

export type CrestLedDayRow = {
  employeeCode: string;
  fullName: string;
  status: string;
  checkInPkt: string | null;
  checkOutPkt: string | null;
  punchCount: number;
};

async function summarizeCrestLedDay(shiftDate: string): Promise<{
  companyId: string;
  activeEmployees: number;
  withCheckIn: number;
  absentOrEmpty: number;
  rows: CrestLedDayRow[];
  employeeIds: string[];
}> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "crest-led"))
    .limit(1);

  if (!company) {
    throw new Error("crest-led company not found");
  }

  const activeEmployees = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)))
    .orderBy(employees.fullName);

  const dayStart = fromZonedTime(`${shiftDate} 00:00:00`, BUSINESS_TIMEZONE);
  const dayEnd = fromZonedTime(`${shiftDate} 23:59:59`, BUSINESS_TIMEZONE);

  const attendanceRows = await db
    .select({
      employeeId: attendanceDays.employeeId,
      status: attendanceDays.status,
      checkInAt: attendanceDays.checkInAt,
      checkOutAt: attendanceDays.checkOutAt,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(and(eq(employees.companyId, company.id), eq(attendanceDays.shiftDate, shiftDate)));

  const attendanceByEmployee = new Map(
    attendanceRows.map((row) => [row.employeeId, row] as const),
  );

  const punchCounts = await db
    .select({
      employeeId: machinePunches.employeeId,
      count: sql<number>`count(*)::int`,
    })
    .from(machinePunches)
    .where(
      and(
        gte(machinePunches.punchAt, dayStart),
        lte(machinePunches.punchAt, dayEnd),
        sql`${machinePunches.employeeId} IS NOT NULL`,
      ),
    )
    .groupBy(machinePunches.employeeId);

  const punchCountByEmployee = new Map(
    punchCounts
      .filter((row): row is { employeeId: string; count: number } => row.employeeId != null)
      .map((row) => [row.employeeId, row.count] as const),
  );

  const rows: CrestLedDayRow[] = activeEmployees.map((employee) => {
    const day = attendanceByEmployee.get(employee.id);
    return {
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      status: day ? effectiveAttendanceStatus(day) : "no row",
      checkInPkt: day?.checkInAt
        ? formatInTimeZone(day.checkInAt, BUSINESS_TIMEZONE, "h:mm:ss a")
        : null,
      checkOutPkt: day?.checkOutAt
        ? formatInTimeZone(day.checkOutAt, BUSINESS_TIMEZONE, "h:mm:ss a")
        : null,
      punchCount: punchCountByEmployee.get(employee.id) ?? 0,
    };
  });

  return {
    companyId: company.id,
    activeEmployees: rows.length,
    withCheckIn: rows.filter((row) => row.checkInPkt).length,
    absentOrEmpty: rows.filter((row) => !row.checkInPkt).length,
    rows,
    employeeIds: activeEmployees.map((employee) => employee.id),
  };
}

/**
 * Re-pull ZKTime punches from the Crest LED workday and rebuild attendance rows
 * (converts false system absents when punches exist).
 */
export async function repairCrestLedAttendanceDay(shiftDate: string): Promise<{
  shiftDate: string;
  before: Omit<Awaited<ReturnType<typeof summarizeCrestLedDay>>, "employeeIds" | "companyId">;
  sync: {
    fetched: number;
    inserted: number;
    processed: number;
    since: string;
    nextSince: string | null;
  };
  reprocessed: number;
  after: Omit<Awaited<ReturnType<typeof summarizeCrestLedDay>>, "employeeIds" | "companyId">;
}> {
  const beforeFull = await summarizeCrestLedDay(shiftDate);
  const { employeeIds, companyId: _companyId, ...before } = beforeFull;
  void _companyId;

  const client = ZktimeClient.fromEnv();
  const sync = await syncAttendanceFromZktime(client, {
    since: `${shiftDate} 00:00:00`,
  });

  await relinkMachinePunchesToEmployees();
  const jobResult = await runProcessMachinePunchesJob({ employeeIds });
  const backfilled = await reconcileAttendanceFromLogForEmployees(employeeIds, new Date(), {
    skipPunchJob: true,
  });

  const afterFull = await summarizeCrestLedDay(shiftDate);
  const { employeeIds: _ids, companyId: _cid, ...after } = afterFull;
  void _ids;
  void _cid;

  return {
    shiftDate,
    before,
    sync,
    reprocessed: jobResult.inserted + backfilled,
    after,
  };
}
