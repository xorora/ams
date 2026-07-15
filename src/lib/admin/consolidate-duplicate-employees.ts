import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees, machinePunches, users } from "@/db/schema";
import {
  codesMatch,
  groupEmployeeDuplicateClusters,
  isSyntheticSyncEmail,
  normalizeEmployeeCodeForMatch,
  type EmployeeRecord,
} from "@/lib/admin/employee-identity";
import { preferAttendanceDay } from "@/lib/admin/attendance-day-preference";
import { effectiveAttendanceStatus } from "@/lib/attendance/effective-status";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import type { AttendanceListItem } from "@/lib/admin/attendance-service";
import { ZktimeClient } from "@/lib/zktime/client";
import { isZktimeConfigured } from "@/lib/zktime/config";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export type ConsolidateDuplicatesResult = {
  clustersMerged: number;
  siblingsDeactivated: number;
  attendanceMoved: number;
  punchesRelinked: number;
  codesAlignedToZktime: number;
  details: Array<{
    canonicalCode: string;
    canonicalName: string;
    deactivatedCodes: string[];
  }>;
};

function toAttendanceListItem(
  row: typeof attendanceDays.$inferSelect,
  employee: EmployeeRecord,
): AttendanceListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    shiftDate: row.shiftDate,
    status: effectiveAttendanceStatus(row),
    source: row.source,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkInLat: row.checkInLat,
    checkInLng: row.checkInLng,
    checkOutLat: row.checkOutLat,
    checkOutLng: row.checkOutLng,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    isMissedCheckout: row.isMissedCheckout,
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
    editedByUserId: row.editedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function punchCountsByEmployee(employeeIds: string[]): Promise<Map<string, number>> {
  if (employeeIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      employeeId: machinePunches.employeeId,
      count: sql<number>`count(*)::int`,
    })
    .from(machinePunches)
    .where(inArray(machinePunches.employeeId, employeeIds))
    .groupBy(machinePunches.employeeId);

  return new Map(
    rows
      .filter((row): row is { employeeId: string; count: number } => row.employeeId != null)
      .map((row) => [row.employeeId, row.count]),
  );
}

function pickCanonicalForMerge(
  members: EmployeeRecord[],
  punchCounts: Map<string, number>,
  zktimeCodes: Set<string>,
): EmployeeRecord {
  return [...members].sort((left, right) => {
    const leftZk = [...zktimeCodes].some((code) => codesMatch(code, left.employeeCode)) ? 1 : 0;
    const rightZk = [...zktimeCodes].some((code) => codesMatch(code, right.employeeCode)) ? 1 : 0;
    if (leftZk !== rightZk) {
      return rightZk - leftZk;
    }

    const leftPunches = punchCounts.get(left.id) ?? 0;
    const rightPunches = punchCounts.get(right.id) ?? 0;
    if (leftPunches !== rightPunches) {
      return rightPunches - leftPunches;
    }

    if (Boolean(left.userId) !== Boolean(right.userId)) {
      return left.userId ? -1 : 1;
    }

    if (isSyntheticSyncEmail(left.email) !== isSyntheticSyncEmail(right.email)) {
      return isSyntheticSyncEmail(left.email) ? 1 : -1;
    }

    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];
}

async function alignCanonicalCodeToZktime(
  canonical: EmployeeRecord,
  members: EmployeeRecord[],
  zktimeCodes: Set<string>,
): Promise<boolean> {
  const preferred = members.find((member) =>
    [...zktimeCodes].some((code) => codesMatch(code, member.employeeCode)),
  );
  if (!preferred || codesMatch(preferred.employeeCode, canonical.employeeCode)) {
    return false;
  }

  let targetCode = preferred.employeeCode;
  for (const code of zktimeCodes) {
    if (codesMatch(code, preferred.employeeCode)) {
      targetCode = code;
      break;
    }
  }

  const [conflict] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeCode, targetCode))
    .limit(1);

  if (conflict && conflict.id !== canonical.id) {
    if (members.some((member) => member.id === conflict.id)) {
      await db
        .update(employees)
        .set({
          employeeCode: `${targetCode}-dup-${conflict.id.slice(0, 8)}`,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, conflict.id));
    } else {
      return false;
    }
  }

  await db
    .update(employees)
    .set({ employeeCode: targetCode, updatedAt: new Date() })
    .where(eq(employees.id, canonical.id));

  return true;
}

async function mergeAttendanceOntoCanonical(
  canonical: EmployeeRecord,
  siblingIds: string[],
): Promise<number> {
  if (siblingIds.length === 0) {
    return 0;
  }

  const now = new Date();
  const allIds = [canonical.id, ...siblingIds];
  const rows = await db.select().from(attendanceDays).where(inArray(attendanceDays.employeeId, allIds));

  const byShift = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byShift.get(row.shiftDate) ?? [];
    list.push(row);
    byShift.set(row.shiftDate, list);
  }

  let moved = 0;

  for (const shiftRows of byShift.values()) {
    if (shiftRows.length === 1) {
      const only = shiftRows[0];
      if (only.employeeId !== canonical.id) {
        await db
          .update(attendanceDays)
          .set({ employeeId: canonical.id, updatedAt: now })
          .where(eq(attendanceDays.id, only.id));
        moved += 1;
      }
      continue;
    }

    const mapped = shiftRows.map((row) => {
      const owner =
        row.employeeId === canonical.id
          ? canonical
          : ({ ...canonical, id: row.employeeId } as EmployeeRecord);
      return { row, item: toAttendanceListItem(row, owner) };
    });

    let winner = mapped[0];
    for (let index = 1; index < mapped.length; index += 1) {
      const candidate = mapped[index];
      const preferred = preferAttendanceDay(winner.item, candidate.item);
      winner = preferred.id === candidate.item.id ? candidate : winner;
    }

    const canonicalRow = shiftRows.find((row) => row.employeeId === canonical.id);
    if (winner.row.employeeId !== canonical.id) {
      if (canonicalRow) {
        await db
          .update(attendanceDays)
          .set({
            status: winner.row.status,
            checkInAt: winner.row.checkInAt,
            checkOutAt: winner.row.checkOutAt,
            isLate: winner.row.isLate,
            isEarlyLeave: winner.row.isEarlyLeave,
            isMissedCheckout: winner.row.isMissedCheckout,
            totalBreakSeconds: winner.row.totalBreakSeconds,
            notes: winner.row.notes ?? canonicalRow.notes,
            updatedAt: now,
          })
          .where(eq(attendanceDays.id, canonicalRow.id));
        await db.delete(attendanceDays).where(eq(attendanceDays.id, winner.row.id));
      } else {
        await db
          .update(attendanceDays)
          .set({ employeeId: canonical.id, updatedAt: now })
          .where(eq(attendanceDays.id, winner.row.id));
      }
      moved += 1;
    }

    for (const entry of mapped) {
      if (entry.row.id === winner.row.id) {
        continue;
      }
      if (canonicalRow && entry.row.id === canonicalRow.id && winner.row.employeeId !== canonical.id) {
        continue;
      }
      if (entry.row.employeeId === canonical.id && entry.row.id !== winner.row.id) {
        await db.delete(attendanceDays).where(eq(attendanceDays.id, entry.row.id));
        moved += 1;
        continue;
      }
      if (entry.row.id !== winner.row.id) {
        await db.delete(attendanceDays).where(eq(attendanceDays.id, entry.row.id));
        moved += 1;
      }
    }
  }

  return moved;
}

export async function consolidateDuplicateEmployees(options: {
  companyId: string;
}): Promise<ServiceFailure | ServiceSuccess<ConsolidateDuplicatesResult>> {
  const companyId = options.companyId.trim();
  if (!companyId) {
    return adminFailure(400, "INVALID_COMPANY", "Company is required.");
  }

  const companyEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.companyId, companyId));

  const clusters = groupEmployeeDuplicateClusters(companyEmployees).filter(
    (cluster) => cluster.members.length > 1,
  );

  const zktimeCodes = new Set<string>();
  if (isZktimeConfigured()) {
    try {
      const client = ZktimeClient.fromEnv();
      const zktimeEmployees = await client.getEmployees();
      for (const item of zktimeEmployees) {
        const code = item.emp_code?.trim();
        if (code) {
          zktimeCodes.add(code);
          zktimeCodes.add(normalizeEmployeeCodeForMatch(code));
        }
      }
    } catch (error) {
      console.warn("[consolidate-duplicates] ZKTime employee fetch failed", error);
    }
  }

  const punchBadges = await db
    .select({
      cardNo: machinePunches.cardNo,
      count: sql<number>`count(*)::int`,
    })
    .from(machinePunches)
    .groupBy(machinePunches.cardNo);

  for (const badge of punchBadges) {
    if (badge.cardNo?.trim()) {
      zktimeCodes.add(badge.cardNo.trim());
    }
  }

  let clustersMerged = 0;
  let siblingsDeactivated = 0;
  let attendanceMoved = 0;
  let punchesRelinked = 0;
  let codesAlignedToZktime = 0;
  const details: ConsolidateDuplicatesResult["details"] = [];

  for (const cluster of clusters) {
    const memberIds = cluster.members.map((member) => member.id);
    const punchCounts = await punchCountsByEmployee(memberIds);
    const canonical = pickCanonicalForMerge(cluster.members, punchCounts, zktimeCodes);
    const siblings = cluster.members.filter((member) => member.id !== canonical.id);
    if (siblings.length === 0) {
      continue;
    }

    if (await alignCanonicalCodeToZktime(canonical, cluster.members, zktimeCodes)) {
      codesAlignedToZktime += 1;
    }

    attendanceMoved += await mergeAttendanceOntoCanonical(
      canonical,
      siblings.map((sibling) => sibling.id),
    );

    const relinked = await db
      .update(machinePunches)
      .set({ employeeId: canonical.id })
      .where(inArray(machinePunches.employeeId, siblings.map((sibling) => sibling.id)))
      .returning({ id: machinePunches.id });
    punchesRelinked += relinked.length;

    for (const sibling of siblings) {
      if (sibling.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, sibling.userId)).limit(1);
        if (user && (!canonical.userId || canonical.userId === user.id)) {
          await linkUserToEmployeeRecord(user.id, canonical.id);
        } else if (user) {
          await db
            .update(users)
            .set({ employeeId: null, updatedAt: new Date() })
            .where(and(eq(users.id, user.id), eq(users.employeeId, sibling.id)));
        }
      }

      await db
        .update(employees)
        .set({
          isActive: false,
          userId: null,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, sibling.id));
      siblingsDeactivated += 1;
    }

    clustersMerged += 1;
    details.push({
      canonicalCode: canonical.employeeCode,
      canonicalName: canonical.fullName,
      deactivatedCodes: siblings.map((sibling) => sibling.employeeCode),
    });
  }

  return {
    ok: true,
    data: {
      clustersMerged,
      siblingsDeactivated,
      attendanceMoved,
      punchesRelinked,
      codesAlignedToZktime,
      details,
    },
  };
}
