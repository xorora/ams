"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EmployeeFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  includeInactive: boolean;
  onIncludeInactiveChange: (value: boolean) => void;
  onAddEmployee: () => void;
};

export function EmployeeFilters({
  search,
  onSearchChange,
  includeInactive,
  onIncludeInactiveChange,
  onAddEmployee,
}: EmployeeFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="employee-search">Search</Label>
        <Input
          id="employee-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Name, email, code…"
          className="min-w-[220px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={(checked) => onIncludeInactiveChange(checked === true)}
          />
          <Label htmlFor="include-inactive" className="font-normal">
            Show inactive
          </Label>
        </div>
        <Button type="button" onClick={onAddEmployee}>
          Add employee
        </Button>
      </div>
    </div>
  );
}
