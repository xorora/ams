"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useRef } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import { leaveTypeLabel } from "@/lib/leave/display";
import {
  formatLeaveFormDate,
  formatLeavePrintDate,
  PAPER_HR_LEAVE_ROWS,
  PAPER_LEAVE_TYPE_ROWS,
  PAPER_LEAVE_TYPE_TO_SYSTEM,
  PAPER_SIGNATURE_ROWS,
  SYSTEM_LEAVE_TO_PAPER,
} from "@/lib/leave/leave-form-layout";
import type { LeaveBalance, LeaveType } from "@/lib/leave/types";
import { countCalendarDays, countWorkingDays } from "@/lib/leave/working-days";
import { cn } from "@/lib/utils";

export type LeaveFormValues = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  medicalCertificateNote: string;
};

function PaperLine({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-7 border-black border-b pb-1 text-sm leading-7", className)}>
      {children}
    </div>
  );
}

function PaperReasonField({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  if (readOnly) {
    return (
      <div className="min-h-7 border-black border-b pb-1 text-sm leading-7 whitespace-pre-wrap">
        {value.trim() || "\u00A0"}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      required
      rows={1}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-7 w-full resize-none overflow-hidden border-0 border-black border-b bg-transparent px-0 py-0 text-sm leading-7 outline-none"
    />
  );
}

function PaperCheckbox({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const interactive = !disabled && onToggle != null;

  const box = (
    <span
      aria-hidden={interactive ? true : undefined}
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center border border-black bg-white",
      )}
    >
      {checked ? <span className="block size-2 bg-black" /> : null}
    </span>
  );

  if (!interactive) {
    return (
      <span className="inline-flex cursor-default items-center gap-1.5 text-[11px] whitespace-nowrap">
        {box}
        {label}
      </span>
    );
  }

  return (
    <label className="group/checkbox inline-flex cursor-pointer items-center gap-1.5 text-[11px] whitespace-nowrap">
      <input
        type="radio"
        name="leave-type"
        checked={checked}
        onChange={() => onToggle()}
        className="sr-only"
      />
      {box}
      {label}
    </label>
  );
}

function computeDays(leaveType: LeaveType, startDate: string, endDate: string): number {
  const config = LEAVE_ENTITLEMENTS[leaveType];
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }
  return config.workingDaysOnly
    ? countWorkingDays(startDate, endDate)
    : countCalendarDays(startDate, endDate);
}

export type LeaveFormDocumentProps = {
  mode: "apply" | "view";
  companyName: string;
  employeeName: string;
  designation?: string | null;
  department?: string | null;
  balances: LeaveBalance[];
  printDate?: string;
  form?: LeaveFormValues;
  onFormChange?: (updater: (values: LeaveFormValues) => LeaveFormValues) => void;
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  daysCount?: number;
  reason?: string;
  medicalCertificateNote?: string | null;
  probationUnpaidOnly?: boolean;
  className?: string;
};

export function LeaveFormDocument({
  mode,
  companyName,
  employeeName,
  designation,
  department,
  balances,
  printDate = formatLeavePrintDate(
    new Date(formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd'T'12:00:00")),
  ),
  form,
  onFormChange,
  leaveType,
  startDate,
  endDate,
  daysCount,
  reason,
  medicalCertificateNote,
  probationUnpaidOnly = false,
  className,
}: LeaveFormDocumentProps) {
  const isApply = mode === "apply";
  const activeLeaveType = isApply ? form?.leaveType : leaveType;
  const activeStart = isApply ? form?.startDate : startDate;
  const activeEnd = isApply ? form?.endDate : endDate;
  const activeReason = isApply ? form?.reason : reason;
  const activeDays =
    isApply && form ? computeDays(form.leaveType, form.startDate, form.endDate) : (daysCount ?? 0);
  const selectedPaperType = activeLeaveType ? SYSTEM_LEAVE_TO_PAPER[activeLeaveType] : null;
  const activeBalance =
    isApply && form && form.leaveType !== "unpaid" ? balanceFor(form.leaveType) : undefined;
  const exceedsBalance =
    activeBalance != null && activeDays > 0 && activeDays > activeBalance.remaining;

  function balanceFor(type: LeaveType) {
    return balances.find((item) => item.leaveType === type);
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[820px] border border-black bg-white px-12 py-8 font-[Arial,Helvetica,sans-serif] text-black shadow-sm",
        className,
      )}
    >
      <div className="text-center">
        <h1 className="font-bold text-xl tracking-wide">Leave Form</h1>
        <p className="mt-1 text-sm">HEAD OFFICE, {companyName}, Lahore</p>
      </div>

      <div className="mt-4 flex items-start justify-end gap-8 text-xs">
        <div className="text-right">
          <div>
            <span className="font-semibold">Print Date:</span> {printDate}
          </div>
          <div className="mt-0.5 italic">Valid for 48 hours only</div>
        </div>
      </div>

      <div className="mt-7 space-y-5 text-sm">
        <div className="grid grid-cols-[72px_1fr] items-end gap-x-3">
          <span className="font-semibold">Name:</span>
          <PaperLine>{employeeName}</PaperLine>
        </div>

        <div className="grid grid-cols-2 gap-x-8">
          <div className="grid grid-cols-[92px_1fr] items-end gap-x-3">
            <span className="font-semibold">Designation:</span>
            <PaperLine>{designation?.trim() || "\u00A0"}</PaperLine>
          </div>
          <div className="grid grid-cols-[92px_1fr] items-end gap-x-3">
            <span className="font-semibold">Department:</span>
            <PaperLine>{department?.trim() || "\u00A0"}</PaperLine>
          </div>
        </div>

        <div className="grid grid-cols-[92px_1fr_36px_1fr_88px_72px] items-end gap-x-3">
          <span className="font-semibold">Applied From:</span>
          {isApply && form && onFormChange ? (
            <DatePicker
              value={form.startDate}
              onChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  startDate: value,
                  endDate: value > current.endDate ? value : current.endDate,
                }))
              }
              className="h-7 rounded-none border-0 border-black border-b bg-transparent px-0 shadow-none"
            />
          ) : (
            <PaperLine>{activeStart ? formatLeaveFormDate(activeStart) : "\u00A0"}</PaperLine>
          )}
          <span className="font-semibold">To:</span>
          {isApply && form && onFormChange ? (
            <DatePicker
              value={form.endDate}
              onChange={(value) => onFormChange((current) => ({ ...current, endDate: value }))}
              className="h-7 rounded-none border-0 border-black border-b bg-transparent px-0 shadow-none"
            />
          ) : (
            <PaperLine>{activeEnd ? formatLeaveFormDate(activeEnd) : "\u00A0"}</PaperLine>
          )}
          <span className="font-semibold">Total Days:</span>
          <PaperLine>{activeDays > 0 ? String(activeDays) : "\u00A0"}</PaperLine>
        </div>

        {exceedsBalance ? (
          <p className="text-destructive text-sm">
            Insufficient {leaveTypeLabel(form?.leaveType ?? "annual")} balance. You have&nbsp;
            {activeBalance?.remaining ?? 0} day(s) remaining but requested {activeDays}.
          </p>
        ) : null}

        <div>
          <p className="font-semibold underline underline-offset-2">Type of Leave:</p>
          {probationUnpaidOnly ? (
            <p className="mt-3 text-sm">
              Emergency unpaid leave (HR approval required). Entitled leave types are not available
              during probation.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {PAPER_LEAVE_TYPE_ROWS.map((row) => (
                <div key={row.join("-")} className="flex flex-wrap gap-x-6 gap-y-3">
                  {row.map((label) => {
                    const systemType = PAPER_LEAVE_TYPE_TO_SYSTEM[label];
                    const checked = selectedPaperType === label;
                    return (
                      <PaperCheckbox
                        key={label}
                        label={label}
                        checked={checked}
                        disabled={!isApply || systemType == null}
                        onToggle={
                          isApply && systemType && form && onFormChange
                            ? () =>
                                onFormChange((current) => ({ ...current, leaveType: systemType }))
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[140px_1fr] items-start gap-x-3">
          <span className="pt-0.5 font-semibold">Reason for Leave:</span>
          {isApply && form && onFormChange ? (
            <PaperReasonField
              value={form.reason}
              onChange={(reason) => onFormChange((current) => ({ ...current, reason }))}
            />
          ) : (
            <PaperReasonField value={activeReason ?? ""} readOnly />
          )}
        </div>

        {isApply &&
        form &&
        onFormChange &&
        LEAVE_ENTITLEMENTS[form.leaveType].requiresMedicalCertificate ? (
          <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
            <span className="font-semibold text-xs">Medical certificate:</span>
            <Input
              required
              value={form.medicalCertificateNote}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  medicalCertificateNote: event.target.value,
                }))
              }
              className="h-7 rounded-none border-0 border-black border-b bg-transparent px-0 shadow-none"
              placeholder="Certificate reference or details"
            />
          </div>
        ) : null}

        {!isApply && medicalCertificateNote ? (
          <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
            <span className="font-semibold text-xs">Medical certificate:</span>
            <PaperLine>{medicalCertificateNote}</PaperLine>
          </div>
        ) : null}

        <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
          <span className="font-semibold">Contact # During Leave:</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
          <span className="font-semibold">Duties transferred to:</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
          <span className="font-semibold">Supervisor comments</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-2 gap-10 pt-6">
          <div>
            <PaperLine className="min-h-10">{"\u00A0"}</PaperLine>
            <p className="mt-2 text-center text-xs">Employee Signature</p>
          </div>
          <div>
            <PaperLine className="min-h-10">{"\u00A0"}</PaperLine>
            <p className="mt-2 text-center text-xs">HOD Signature</p>
          </div>
        </div>
      </div>

      <div className="mt-10 border-black border-t pt-6">
        <h2 className="text-center font-bold text-sm">For Human Resource Department</h2>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-black px-3 py-2 text-left font-semibold" />
              <th className="border border-black px-3 py-2 text-center font-semibold">
                Leaves Allowed
              </th>
              <th className="border border-black px-3 py-2 text-center font-semibold">
                Leave/s Availed
              </th>
              <th className="border border-black px-3 py-2 text-center font-semibold">
                Leave/s Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {PAPER_HR_LEAVE_ROWS.map(({ label, leaveType: type }) => {
              const balance = balanceFor(type);
              return (
                <tr key={label}>
                  <td className="border border-black px-3 py-2 font-semibold">{label}</td>
                  <td className="border border-black px-3 py-2 text-center tabular-nums">
                    {balance?.entitled ?? "—"}
                  </td>
                  <td className="border border-black px-3 py-2 text-center tabular-nums">
                    {balance?.used ?? "—"}
                  </td>
                  <td className="border border-black px-3 py-2 text-center tabular-nums">
                    {balance?.remaining ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 flex items-center gap-8 text-xs">
          <PaperCheckbox
            checked={activeLeaveType != null && activeLeaveType !== "unpaid"}
            label="Paid"
            disabled
          />
          <PaperCheckbox checked={activeLeaveType === "unpaid"} label="Unpaid" disabled />
        </div>

        <div className="mt-8 space-y-10">
          {PAPER_SIGNATURE_ROWS.map((row) => (
            <div
              key={row.join("-")}
              className={cn(
                "grid gap-8",
                row.length === 2 && "grid-cols-2",
                row.length === 3 && "grid-cols-3",
              )}
            >
              {row.map((label) => (
                <div key={label}>
                  <PaperLine className="min-h-10">{"\u00A0"}</PaperLine>
                  <p className="mt-2 text-center text-[11px]">{label}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
