import { fromZonedTime } from "date-fns-tz";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { employees, machinePunches } from "@/db/schema";
import {
  relinkMachinePunchesToEmployees,
  runProcessMachinePunchesJob,
} from "@/lib/attendance/machine-punch-processor";
import type { ZktimeClient } from "@/lib/zktime/client";
import { getZktimeTimezone } from "@/lib/zktime/config";
import { getLastAttendanceNextSince, setLastAttendanceNextSince } from "@/lib/zktime/sync-state";

function parsePunchAt(datetime: string): Date {
  return fromZonedTime(datetime, getZktimeTimezone());
}

function resolveTransactionEmployeeName(tx: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  emp_code: string;
}): string {
  const fullName = tx.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const composed = [tx.first_name?.trim(), tx.last_name?.trim()].filter(Boolean).join(" ");
  return composed || tx.emp_code;
}

async function resolveEmployeeIdsByCode(codes: string[]): Promise<Map<string, string>> {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];
  const resolved = new Map<string, string>();
  if (uniqueCodes.length === 0) {
    return resolved;
  }

  const rows = await db
    .select({ id: employees.id, employeeCode: employees.employeeCode })
    .from(employees)
    .where(inArray(employees.employeeCode, uniqueCodes));

  for (const row of rows) {
    resolved.set(row.employeeCode, row.id);
  }

  return resolved;
}

export type AttendanceSyncResult = {
  fetched: number;
  inserted: number;
  since: string;
  nextSince: string | null;
};

export async function syncAttendanceFromZktime(
  client: ZktimeClient,
  options: { since?: string } = {},
): Promise<AttendanceSyncResult> {
  const since = options.since ?? (await getLastAttendanceNextSince());
  const { transactions, nextSince } = await client.exportTransactions(since);

  if (nextSince) {
    await setLastAttendanceNextSince(nextSince);
  }

  if (transactions.length === 0) {
    return { fetched: 0, inserted: 0, since, nextSince };
  }

  const employeeIdsByCode = await resolveEmployeeIdsByCode(transactions.map((tx) => tx.emp_code));

  const rows = transactions.map((tx) => ({
    sourceSystem: "zkteco" as const,
    sourcePunchId: tx.id,
    cardNo: tx.emp_code,
    punchAt: parsePunchAt(tx.punch_time),
    machineNo: tx.terminal_sn ?? null,
    isManual: false,
    machineEmpCode: tx.emp_code,
    machineEmpName: resolveTransactionEmployeeName(tx),
    employeeId: employeeIdsByCode.get(tx.emp_code) ?? null,
    rawPunchAt: [tx.punch_time, tx.punch_state_display, tx.verify_type_display]
      .filter(Boolean)
      .join("|"),
  }));

  const insertedRows = await db
    .insert(machinePunches)
    .values(rows)
    .onConflictDoNothing({
      target: [machinePunches.cardNo, machinePunches.punchAt],
    })
    .returning({
      id: machinePunches.id,
      employeeId: machinePunches.employeeId,
    });

  if (insertedRows.length > 0) {
    await relinkMachinePunchesToEmployees();

    const insertedIds = insertedRows.map((row) => row.id);
    const linkedRows = await db
      .select({ employeeId: machinePunches.employeeId })
      .from(machinePunches)
      .where(inArray(machinePunches.id, insertedIds));

    const affectedEmployeeIds = [
      ...new Set(linkedRows.flatMap((row) => (row.employeeId ? [row.employeeId] : []))),
    ];

    if (affectedEmployeeIds.length > 0) {
      await runProcessMachinePunchesJob({ employeeIds: affectedEmployeeIds });
    }
  }

  return {
    fetched: transactions.length,
    inserted: insertedRows.length,
    since,
    nextSince,
  };
}
