export type AttendanceDayForAbsentJob = {
  checkInAt: Date | null;
  status: "present" | "absent" | "leave";
  source?: "auto" | "manual" | "system";
};

/**
 * Whether the cron should create or update an absent row for this shift.
 * Skips check-ins, leave, admin/system present, manual rows, and existing absent marks.
 */
export function shouldAutoMarkAbsent(day: AttendanceDayForAbsentJob | null): boolean {
  if (!day) {
    return true;
  }
  if (day.checkInAt != null) {
    return false;
  }
  if (day.status === "leave") {
    return false;
  }
  if (day.status === "present") {
    return false;
  }
  if (day.status === "absent") {
    return false;
  }
  if (day.source === "manual") {
    return false;
  }
  return true;
}
