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
import type { SerializedEmployee } from "@/lib/admin/serialize";
import type { OvertimeRequestStatus } from "@/lib/overtime/types";

export type OvertimeFiltersState = {
  status?: OvertimeRequestStatus;
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

type OvertimeFiltersProps = {
  filters: OvertimeFiltersState;
  employees?: SerializedEmployee[];
  onChange: (patch: Partial<OvertimeFiltersState>) => void;
};

export function OvertimeFilters({ filters, employees, onChange }: OvertimeFiltersProps) {
  const employeeItems = useMemo(() => {
    const items: Record<string, string> = { [ALL]: "All employees" };
    for (const employee of employees ?? []) {
      items[employee.id] = employee.fullName;
    }
    return items;
  }, [employees]);

  return (
    <div className="flex flex-wrap items-end gap-4">
      {employees ? (
        <div className="flex min-w-[200px] flex-col gap-1.5">
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

      <div className="flex min-w-[160px] flex-col gap-1.5">
        <Label>Status</Label>
        <Select
          items={STATUS_ITEMS}
          value={filters.status ?? ALL}
          onValueChange={(value) =>
            onChange({
              status: !value || value === ALL ? undefined : (value as OvertimeRequestStatus),
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
    </div>
  );
}
