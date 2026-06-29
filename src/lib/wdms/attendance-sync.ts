import { fromZonedTime } from "date-fns-tz";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { employees, machinePunches } from "@/db/schema";
import {
  relinkMachinePunchesToEmployees,
  runProcessMachinePunchesJob,
} from "@/lib/attendance/machine-punch-processor";
import type { WdmsClient } from "@/lib/wdms/client";
import { getWdmsTimezone } from "@/lib/wdms/config";
import { getLastAttendanceUploadTime, setLastAttendanceUploadTime } from "@/lib/wdms/sync-state";
import type { WdmsTransaction } from "@/lib/wdms/types";

function parsePunchAt(datetime: string): Date {
  return fromZonedTime(datetime, getWdmsTimezone());
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

function buildMachineName(tx: WdmsTransaction): string {
  const name = [tx.first_name, tx.last_name].filter(Boolean).join(" ").trim();
  return name || tx.emp_code;
}

export type AttendanceSyncResult = {
  fetched: number;
  inserted: number;
  since: string;
  latest: string | null;
};

export async function syncAttendanceFromWdms(client: WdmsClient): Promise<AttendanceSyncResult> {
  const since = await getLastAttendanceUploadTime();
  const transactions = await client.getAllTransactionsSince(since);

  if (transactions.length === 0) {
    return { fetched: 0, inserted: 0, since, latest: null };
  }

  const employeeIdsByCode = await resolveEmployeeIdsByCode(transactions.map((tx) => tx.emp_code));

  const rows = transactions.map((tx) => ({
    sourceSystem: "wdms" as const,
    sourcePunchId: tx.id,
    cardNo: tx.emp_code,
    punchAt: parsePunchAt(tx.punch_time),
    machineNo: tx.terminal_sn,
    isManual: false,
    machineEmpCode: tx.emp_code,
    machineEmpName: buildMachineName(tx),
    employeeId: employeeIdsByCode.get(tx.emp_code) ?? null,
    rawPunchAt: `${tx.punch_time}|${tx.punch_state_display}|${tx.verify_type_display}`,
  }));

  const insertedRows = await db
    .insert(machinePunches)
    .values(rows)
    .onConflictDoNothing({
      target: [machinePunches.sourceSystem, machinePunches.sourcePunchId],
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

  const latest = transactions.at(-1)?.upload_time ?? null;
  if (latest) {
    await setLastAttendanceUploadTime(latest);
  }

  return {
    fetched: transactions.length,
    inserted: insertedRows.length,
    since,
    latest,
  };
}
