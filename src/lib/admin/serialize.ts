import type { AttendanceListItem } from "./attendance-service";
import type { EmployeeOption, EmployeeRecord } from "./employees-service";
import type { LeaveBalance } from "@/lib/leave/types";

export type SerializedEmployee = Omit<EmployeeRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  pendingLateFinePkr: number;
  pendingFineableLates: number;
  leaveBalances: LeaveBalance[];
};

/** Dropdown / filter option — avoids shipping full employee records to the client. */
export type SerializedEmployeeOption = EmployeeOption;

export type SerializedAttendance = Omit<
  AttendanceListItem,
  "checkInAt" | "checkOutAt" | "createdAt" | "updatedAt"
> & {
  checkInAt: string | null;
  checkOutAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeEmployee(
  employee: EmployeeRecord,
  pendingFines: { pendingLateFinePkr: number; pendingFineableLates: number } = {
    pendingLateFinePkr: 0,
    pendingFineableLates: 0,
  },
  leaveBalances: LeaveBalance[] = [],
): SerializedEmployee {
  return {
    ...employee,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    pendingLateFinePkr: pendingFines.pendingLateFinePkr,
    pendingFineableLates: pendingFines.pendingFineableLates,
    leaveBalances,
  };
}

export function serializeAttendance(record: AttendanceListItem): SerializedAttendance {
  return {
    ...record,
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
