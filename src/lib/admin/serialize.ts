import type { AttendanceListItem } from "./attendance-service";
import type { EmployeeRecord } from "./employees-service";

export type SerializedEmployee = Omit<EmployeeRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedAttendance = Omit<
  AttendanceListItem,
  "checkInAt" | "checkOutAt" | "overtimeStartedAt" | "overtimeEndedAt" | "createdAt" | "updatedAt"
> & {
  checkInAt: string | null;
  checkOutAt: string | null;
  overtimeStartedAt: string | null;
  overtimeEndedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeEmployee(employee: EmployeeRecord): SerializedEmployee {
  return {
    ...employee,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

export function serializeAttendance(record: AttendanceListItem): SerializedAttendance {
  return {
    ...record,
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    overtimeStartedAt: record.overtimeStartedAt?.toISOString() ?? null,
    overtimeEndedAt: record.overtimeEndedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
