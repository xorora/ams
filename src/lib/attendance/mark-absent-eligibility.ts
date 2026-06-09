export type AttendanceDayForAutoJob = {
  checkInAt: Date | null;
  status: "present" | "absent" | "leave" | "weekend_off";
  source?: "auto" | "manual" | "system";
};

/**
 * Whether the cron should create or update a weekend-off row for this shift.
 * Skips check-ins, leave, present, manual rows, and existing weekend-off marks.
 * Upgrades legacy system absent rows created before weekend handling.
 */
export function shouldAutoMarkWeekendOff(day: AttendanceDayForAutoJob | null): boolean {
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
  if (day.status === "weekend_off") {
    return false;
  }
  if (day.source === "manual") {
    return false;
  }
  return true;
}

/**
 * Whether the cron should create or update an absent row for this shift.
 * Skips check-ins, leave, admin/system present, manual rows, and existing absent marks.
 */
export function shouldAutoMarkAbsent(day: AttendanceDayForAutoJob | null): boolean {
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
  if (day.status === "weekend_off") {
    return false;
  }
  if (day.source === "manual") {
    return false;
  }
  return true;
}
