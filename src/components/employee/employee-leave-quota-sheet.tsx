"use client";

import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import type { LeaveBalance } from "@/lib/leave/types";

type EmployeeLeaveQuotaSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: SerializedEmployee | null;
  balances: LeaveBalance[];
  year: number;
};

export function EmployeeLeaveQuotaSheet({
  open,
  onOpenChange,
  employee,
  balances,
  year,
}: EmployeeLeaveQuotaSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[min(70dvh,640px)] w-full flex-col gap-0 p-0 sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl"
      >
        <SheetHeader className="shrink-0 gap-1.5 px-4 pt-1 pb-3 sm:px-6">
          <SheetTitle>
            {employee ? `Leave quota · ${employee.fullName}` : "Leave quota"}
          </SheetTitle>
        </SheetHeader>

        {employee ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="rounded-xl border border-white/12 bg-[#050d22]/70 px-4 py-3">
              <p className="font-mono text-xs text-[#c8cce0]">{employee.employeeCode}</p>
              <p className="mt-1 text-sm text-[#d7dceb]">
                {[employee.designation, employee.department].filter(Boolean).join(" · ") ||
                  "No role details"}
              </p>
              <p className="mt-2 text-xs font-medium text-[#9aa3b8]">Calendar year {year} (PKT)</p>
            </div>

            {balances.length > 0 ? (
              <LeaveBalanceCards balances={balances} />
            ) : (
              <p className="text-sm text-[#c8cce0]">No entitled leave balances for this employee.</p>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
