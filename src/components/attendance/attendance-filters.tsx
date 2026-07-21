"use client";

import { useMemo } from "react";
import type { AttendanceStatus } from "@/components/attendance/attendance-sheet";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SerializedEmployeeOption } from "@/lib/admin/serialize";

export type AttendanceFiltersState = {
  from: string;
  to: string;
  employeeId: string;
  status: "" | AttendanceStatus;
  page?: number;
  limit?: number;
};

type AttendanceFiltersProps = {
  filters: AttendanceFiltersState;
  onFiltersChange: React.Dispatch<React.SetStateAction<AttendanceFiltersState>>;
  employees: SerializedEmployeeOption[];
  onAddRecord: () => void;
};

const ALL_EMPLOYEES = "__all_employees__";
const ALL_STATUSES = "__all_statuses__";

const STATUS_ITEMS: Record<string, string> = {
  [ALL_STATUSES]: "All statuses",
  present: "Present",
  absent: "Absent",
  leave: "Leave",
  weekend_off: "Weekend off",
};

export function AttendanceFilters({
  filters,
  onFiltersChange,
  employees,
  onAddRecord,
}: AttendanceFiltersProps) {
  const employeeItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_EMPLOYEES]: "All employees" };
    for (const employee of employees) {
      items[employee.id] = employee.fullName;
    }
    return items;
  }, [employees]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendance-from">From shift date</Label>
        <DatePicker
          id="attendance-from"
          value={filters.from}
          onChange={(from) => onFiltersChange((f) => ({ ...f, from }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendance-to">To shift date</Label>
        <DatePicker
          id="attendance-to"
          value={filters.to}
          onChange={(to) => onFiltersChange((f) => ({ ...f, to }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Employee</Label>
        <Select
          items={employeeItems}
          value={filters.employeeId || ALL_EMPLOYEES}
          onValueChange={(value) =>
            onFiltersChange((f) => ({
              ...f,
              employeeId: value === ALL_EMPLOYEES ? "" : (value as string),
            }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_EMPLOYEES}>All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <Select
          items={STATUS_ITEMS}
          value={filters.status || ALL_STATUSES}
          onValueChange={(value) =>
            onFiltersChange((f) => ({
              ...f,
              status: value === ALL_STATUSES ? "" : (value as AttendanceStatus),
            }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="weekend_off">Weekend off</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="button" onClick={onAddRecord} className="w-full sm:w-auto">
          Add record
        </Button>
      </div>
    </div>
  );
}
