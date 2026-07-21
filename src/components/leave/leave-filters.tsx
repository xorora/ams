"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SerializedEmployeeOption } from "@/lib/admin/serialize";
import { ENTITLED_LEAVE_TYPES } from "@/lib/leave/constants";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { LeaveRequestStatus, LeaveType } from "@/lib/leave/types";

export type LeaveFiltersState = {
  status?: LeaveRequestStatus;
  leaveType?: LeaveType;
  employeeId?: string;
};

const ALL = "__all__";

const STATUS_ITEMS: Record<string, string> = {
  [ALL]: "All statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

type LeaveFiltersProps = {
  filters: LeaveFiltersState;
  employees?: SerializedEmployeeOption[];
  onChange: (patch: Partial<LeaveFiltersState>) => void;
};

export function LeaveFilters({ filters, employees, onChange }: LeaveFiltersProps) {
  const employeeItems = useMemo(() => {
    const items: Record<string, string> = { [ALL]: "All employees" };
    for (const employee of employees ?? []) {
      items[employee.id] = employee.fullName;
    }
    return items;
  }, [employees]);

  const leaveTypeItems = useMemo(() => {
    const items: Record<string, string> = { [ALL]: "All types" };
    for (const type of [...ENTITLED_LEAVE_TYPES, "unpaid" as const]) {
      items[type] = leaveTypeLabel(type);
    }
    return items;
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {employees ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Employee</Label>
          <Select
            items={employeeItems}
            value={filters.employeeId ?? ALL}
            onValueChange={(value) =>
              onChange({
                employeeId: !value || value === ALL ? undefined : (value as string),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All employees</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>Status</Label>
        <Select
          items={STATUS_ITEMS}
          value={filters.status ?? ALL}
          onValueChange={(value) =>
            onChange({
              status: !value || value === ALL ? undefined : (value as LeaveRequestStatus),
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>Leave type</Label>
        <Select
          items={leaveTypeItems}
          value={filters.leaveType ?? ALL}
          onValueChange={(value) =>
            onChange({
              leaveType: !value || value === ALL ? undefined : (value as LeaveType),
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {[...ENTITLED_LEAVE_TYPES, "unpaid" as const].map((type) => (
              <SelectItem key={type} value={type}>
                {leaveTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
