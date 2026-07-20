"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CreateSalarySlipSheet } from "@/components/accounting/create-salary-slip-sheet";
import { SalarySlipsTable } from "@/components/accounting/salary-slips-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salarySlipListQuery } from "@/lib/accounting/query-params";
import type {
  SerializedCompensationListItem,
  SerializedSalarySlipListItem,
} from "@/lib/accounting/types";

const ALL_EMPLOYEES = "__all__";

type SalarySlipsManagerProps = {
  slips: SerializedSalarySlipListItem[];
  employees: SerializedCompensationListItem[];
  yearMonth: string;
  employeeId?: string;
  companyName: string;
};

export function SalarySlipsManager({
  slips,
  employees,
  yearMonth,
  employeeId,
  companyName,
}: SalarySlipsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [monthInput, setMonthInput] = useState(yearMonth);

  useEffect(() => {
    setMonthInput(yearMonth);
  }, [yearMonth]);

  const employeeItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_EMPLOYEES]: "All employees" };
    for (const employee of employees) {
      items[employee.employeeId] = employee.fullName;
    }
    return items;
  }, [employees]);

  const configuredEmployees = useMemo(
    () => employees.filter((employee) => employee.grossSalaryPkr != null),
    [employees],
  );

  function navigateFilters(nextYearMonth: string, nextEmployeeId?: string) {
    startTransition(() => {
      router.replace(
        `/admin/accounting/salary-slips${salarySlipListQuery({
          yearMonth: nextYearMonth,
          employeeId: nextEmployeeId,
        })}`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[180px]">
          <Label htmlFor="slip-month">Month</Label>
          <Input
            id="slip-month"
            type="month"
            value={monthInput}
            onChange={(event) => {
              const value = event.target.value;
              setMonthInput(value);
              if (value) {
                navigateFilters(value, employeeId);
              }
            }}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[200px]">
          <Label>Employee</Label>
          <Select
            items={employeeItems}
            value={employeeId ?? ALL_EMPLOYEES}
            onValueChange={(value) => {
              navigateFilters(
                yearMonth,
                !value || value === ALL_EMPLOYEES ? undefined : (value as string),
              );
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EMPLOYEES}>All employees</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.employeeId} value={employee.employeeId}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" className="w-full sm:col-span-2 sm:w-auto lg:col-span-1" onClick={() => setCreateOpen(true)}>
          Create slip
        </Button>
      </div>

      <SalarySlipsTable
        className="md:min-h-0 md:flex-1"
        slips={slips}
        loading={isPending}
        resetDeps={[yearMonth, employeeId]}
      />

      <CreateSalarySlipSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={configuredEmployees}
        defaultYearMonth={yearMonth}
        companyName={companyName}
      />
    </div>
  );
}
