import type { AttendanceListItem } from "@/lib/admin/attendance-service";

function attendanceQualityScore(row: AttendanceListItem): number {
  let score = 0;
  if (row.checkInAt) {
    score += 8;
  }
  if (row.status === "present") {
    score += 4;
  } else if (row.status === "leave") {
    score += 3;
  } else if (row.status === "weekend_off") {
    score += 2;
  } else if (row.status === "absent") {
    score += 1;
  }
  if (row.checkOutAt) {
    score += 2;
  }
  return score;
}

/** Prefer the richer attendance day when siblings both have the same shiftDate. */
export function preferAttendanceDay(
  left: AttendanceListItem,
  right: AttendanceListItem,
): AttendanceListItem {
  const leftScore = attendanceQualityScore(left);
  const rightScore = attendanceQualityScore(right);
  if (leftScore !== rightScore) {
    return leftScore >= rightScore ? left : right;
  }
  const leftUpdated = left.updatedAt?.getTime() ?? 0;
  const rightUpdated = right.updatedAt?.getTime() ?? 0;
  return leftUpdated >= rightUpdated ? left : right;
}
