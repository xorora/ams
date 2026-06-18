"use client";

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

type OvertimeFiltersProps = {
  filters: OvertimeFiltersState;
  employees?: SerializedEmployee[];
  onChange: (filters: OvertimeFiltersState) => void;
};

export function OvertimeFilters({ filters, employees, onChange }: OvertimeFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {employees ? (
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <Label>Employee</Label>
          <Select
            value={filters.employeeId ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                employeeId: !value || value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
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
          value={filters.status ?? "all"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              status: value === "all" ? undefined : (value as OvertimeRequestStatus),
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
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
