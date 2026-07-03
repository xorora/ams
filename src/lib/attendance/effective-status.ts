type AttendanceStatus = "present" | "absent" | "leave" | "weekend_off";

type AttendanceStatusInput = {
  status: string;
  checkInAt: Date | null | undefined;
};

/** Anyone with a check-in is treated as present unless the day is leave or weekend off. */
export function effectiveAttendanceStatus(row: AttendanceStatusInput): AttendanceStatus {
  if (row.status === "leave" || row.status === "weekend_off") {
    return row.status;
  }

  if (row.checkInAt) {
    return "present";
  }

  if (row.status === "present" || row.status === "absent") {
    return row.status;
  }

  return "absent";
}
