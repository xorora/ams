"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import {
  getProbationStatusLabel,
  isCurrentlyOnProbation,
  isProbationCompleted,
} from "@/lib/admin/probation";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type EmployeeTableProps = {
  employees: SerializedEmployee[];
  loading: boolean;
  onEdit: (employee: SerializedEmployee) => void;
  onClearanceForm?: (employee: SerializedEmployee) => void;
  onViewLeaveQuota?: (employee: SerializedEmployee) => void;
  onDeactivate: (id: string, name: string) => void;
  onReactivate: (id: string) => void;
  onStartProbation?: (id: string, name: string) => void;
  onEndProbation?: (id: string, name: string) => void;
  showShiftPreset?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

function remainingForType(employee: SerializedEmployee, leaveType: "annual" | "casual" | "sick") {
  return employee.leaveBalances.find((balance) => balance.leaveType === leaveType)?.remaining;
}

function LeaveRemainingCell({ value }: { value: number | undefined }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{value}</span>;
}

function probationBadgeVariant(employee: SerializedEmployee): "default" | "secondary" | "outline" {
  if (isCurrentlyOnProbation(employee)) {
    return "default";
  }
  if (isProbationCompleted(employee)) {
    return "outline";
  }
  return "secondary";
}

function shiftPresetLabel(preset: string | null | undefined): string {
  if (preset === "evening") {
    return "6pm–3am";
  }
  if (preset === "day") {
    return "9am–5pm · break 1–2pm (Fri 1–2:30pm)";
  }
  if (preset === "afternoon") {
    return "3pm–12am · break 7–8pm";
  }
  return "—";
}

export function EmployeeTable({
  employees,
  loading,
  onEdit,
  onClearanceForm,
  onViewLeaveQuota,
  onDeactivate,
  onReactivate,
  onStartProbation,
  onEndProbation,
  showShiftPreset = false,
  resetDeps,
  className,
}: EmployeeTableProps) {
  const columns = useMemo<ColumnDef<SerializedEmployee>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: "Code",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.employeeCode}</span>,
      },
      {
        accessorKey: "fullName",
        header: "Name",
      },
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        id: "designation",
        accessorFn: (row) => row.designation ?? "—",
        header: "Designation",
        cell: ({ row }) => row.original.designation ?? "—",
      },
      {
        id: "department",
        accessorFn: (row) => row.department ?? "—",
        header: "Department",
        cell: ({ row }) => row.original.department ?? "—",
      },
      ...(showShiftPreset
        ? [
            {
              id: "shift",
              accessorFn: (row: SerializedEmployee) => shiftPresetLabel(row.shiftPreset),
              header: "Shift",
              cell: ({ row }: { row: { original: SerializedEmployee } }) =>
                shiftPresetLabel(row.original.shiftPreset),
            } satisfies ColumnDef<SerializedEmployee>,
          ]
        : []),
      {
        id: "annualLeave",
        accessorFn: (row) => remainingForType(row, "annual") ?? -1,
        header: "Annual left",
        meta: { align: "right" },
        cell: ({ row }) => <LeaveRemainingCell value={remainingForType(row.original, "annual")} />,
      },
      {
        id: "casualLeave",
        accessorFn: (row) => remainingForType(row, "casual") ?? -1,
        header: "Casual left",
        meta: { align: "right" },
        cell: ({ row }) => <LeaveRemainingCell value={remainingForType(row.original, "casual")} />,
      },
      {
        id: "sickLeave",
        accessorFn: (row) => remainingForType(row, "sick") ?? -1,
        header: "Sick left",
        meta: { align: "right" },
        cell: ({ row }) => <LeaveRemainingCell value={remainingForType(row.original, "sick")} />,
      },
      {
        id: "status",
        accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "probation",
        accessorFn: (row) => getProbationStatusLabel(row),
        header: "Probation",
        cell: ({ row }) => (
          <Badge variant={probationBadgeVariant(row.original)}>
            {getProbationStatusLabel(row.original)}
          </Badge>
        ),
      },
      {
        id: "pendingFines",
        accessorFn: (row) => row.pendingLateFinePkr,
        header: "Pending fines",
        meta: { align: "right" },
        cell: ({ row }) => {
          const { pendingLateFinePkr, pendingFineableLates } = row.original;
          if (pendingLateFinePkr <= 0) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <div className="text-right">
              <div className="font-medium text-destructive tabular-nums">
                {formatLateFinePkr(pendingLateFinePkr)}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {pendingFineableLates} fined late{pendingFineableLates === 1 ? "" : "s"}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const employee = row.original;
          const onProbation = isCurrentlyOnProbation(employee);

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8"
                    aria-label="Open actions menu"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(employee)}>Edit</DropdownMenuItem>
                {onViewLeaveQuota ? (
                  <DropdownMenuItem onClick={() => onViewLeaveQuota(employee)}>
                    View leave quota
                  </DropdownMenuItem>
                ) : null}
                {onClearanceForm ? (
                  <DropdownMenuItem onClick={() => onClearanceForm(employee)}>
                    Clearance form
                  </DropdownMenuItem>
                ) : null}
                {employee.isActive && onProbation && onEndProbation ? (
                  <DropdownMenuItem onClick={() => onEndProbation(employee.id, employee.fullName)}>
                    End probation
                  </DropdownMenuItem>
                ) : null}
                {employee.isActive &&
                !onProbation &&
                !isProbationCompleted(employee) &&
                onStartProbation ? (
                  <DropdownMenuItem
                    onClick={() => onStartProbation(employee.id, employee.fullName)}
                  >
                    Start probation
                  </DropdownMenuItem>
                ) : null}
                {employee.isActive ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDeactivate(employee.id, employee.fullName)}
                    >
                      Deactivate
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => onReactivate(employee.id)}>
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      onClearanceForm,
      onDeactivate,
      onEdit,
      onEndProbation,
      onReactivate,
      onStartProbation,
      onViewLeaveQuota,
      showShiftPreset,
    ],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={employees}
      loading={loading}
      emptyMessage="No employees found."
      resetDeps={resetDeps}
    />
  );
}
