import { fromZonedTime } from "date-fns-tz";
import { inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { biometricEmployeeMappings, employees, machinePunches } from "@/db/schema";
import {
  relinkMachinePunchesToEmployees,
  runProcessMachinePunchesJob,
} from "@/lib/attendance/machine-punch-processor";
import type { AttlogRecord } from "@/lib/zkteco/adms/parser";
import { getZktecoTimezone } from "@/lib/zkteco/config";
import { hashAdmsPunchId } from "@/lib/zkteco/device-service";

function parsePunchAt(datetime: string): Date {
  return fromZonedTime(datetime, getZktecoTimezone());
}

async function resolveEmployeeIdsByPin(pins: string[]): Promise<Map<string, string>> {
  const uniquePins = [...new Set(pins.filter(Boolean))];
  const resolved = new Map<string, string>();
  if (uniquePins.length === 0) {
    return resolved;
  }

  const byCode = await db
    .select({ id: employees.id, employeeCode: employees.employeeCode })
    .from(employees)
    .where(inArray(employees.employeeCode, uniquePins));

  for (const row of byCode) {
    resolved.set(row.employeeCode, row.id);
  }

  const unresolvedPins = uniquePins.filter((pin) => !resolved.has(pin));
  if (unresolvedPins.length === 0) {
    return resolved;
  }

  const byCard = await db
    .select({ id: employees.id, machineCardNo: employees.machineCardNo })
    .from(employees)
    .where(inArray(employees.machineCardNo, unresolvedPins));

  for (const row of byCard) {
    if (row.machineCardNo) {
      resolved.set(row.machineCardNo, row.id);
    }
  }

  const stillUnresolved = unresolvedPins.filter((pin) => !resolved.has(pin));
  if (stillUnresolved.length === 0) {
    return resolved;
  }

  const mappingConditions = [inArray(biometricEmployeeMappings.devicePin, stillUnresolved)];
  if (stillUnresolved.length > 0) {
    mappingConditions.push(inArray(biometricEmployeeMappings.cardNo, stillUnresolved));
  }

  const mappings = await db
    .select({
      employeeId: biometricEmployeeMappings.employeeId,
      devicePin: biometricEmployeeMappings.devicePin,
      cardNo: biometricEmployeeMappings.cardNo,
    })
    .from(biometricEmployeeMappings)
    .where(or(...mappingConditions));

  for (const mapping of mappings) {
    if (mapping.devicePin && stillUnresolved.includes(mapping.devicePin)) {
      resolved.set(mapping.devicePin, mapping.employeeId);
    }
    if (mapping.cardNo && stillUnresolved.includes(mapping.cardNo)) {
      resolved.set(mapping.cardNo, mapping.employeeId);
    }
  }

  return resolved;
}

export async function ingestAttlogRecords(
  serialNumber: string,
  records: AttlogRecord[],
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const employeeIdsByPin = await resolveEmployeeIdsByPin(records.map((record) => record.pin));

  const rows = records.map((record) => {
    const cardNo = record.pin;
    return {
      sourceSystem: "zkteco" as const,
      sourcePunchId: hashAdmsPunchId(serialNumber, record.pin, record.datetime),
      cardNo,
      punchAt: parsePunchAt(record.datetime),
      machineNo: serialNumber,
      isManual: false,
      machineEmpCode: record.pin,
      employeeId: employeeIdsByPin.get(record.pin) ?? null,
      rawPunchAt: record.datetime,
    };
  });

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

  if (insertedRows.length === 0) {
    return 0;
  }

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

  return insertedRows.length;
}
