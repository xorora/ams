"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useRef } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import { formatLeaveDays, leaveTypeLabel } from "@/lib/leave/display";
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
import { countCalendarDays, countWorkingDaysForCompany } from "@/lib/leave/working-days";
import { getCompanyShiftConfig } from "@/lib/attendance/company-shift";
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
    <div className={cn("leave-form-rule min-h-7 border-b pb-1 text-sm leading-7", className)}>
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
      <div className="leave-form-rule min-h-7 border-b pb-1 text-sm leading-7 whitespace-pre-wrap">
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
      className="leave-form-rule min-h-7 w-full resize-none overflow-hidden border-0 border-b bg-transparent px-0 py-0 text-sm leading-7 text-inherit outline-none"
    />
  );
}

function PaperCheckbox({
  checked,
  label,
  disabled,
  inputType = "radio",
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  inputType?: "radio" | "checkbox";
  onToggle?: () => void;
}) {
  const interactive = !disabled && onToggle != null;

  const box = (
    <span
      aria-hidden={interactive ? true : undefined}
      className={cn(
        "leave-form-box inline-flex size-3.5 shrink-0 items-center justify-center border",
      )}
    >
      {checked ? <span className="leave-form-box-fill block size-2" /> : null}
    </span>
  );

  if (!interactive) {
    return (
      <span className="inline-flex cursor-default items-center gap-1.5 text-[11px] sm:whitespace-nowrap">
        {box}
        {label}
      </span>
    );
  }

  return (
    <label className="group/checkbox inline-flex cursor-pointer items-center gap-1.5 text-[11px] sm:whitespace-nowrap">
      <input
        type={inputType}
        name={inputType === "radio" ? "leave-type" : undefined}
        checked={checked}
        onChange={() => onToggle()}
        className="sr-only"
      />
      {box}
      {label}
    </label>
  );
}

function computeDays(
  leaveType: LeaveType,
  startDate: string,
  endDate: string,
  companySlug: string,
): number {
  const config = LEAVE_ENTITLEMENTS[leaveType];
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }
  const shiftConfig = getCompanyShiftConfig(companySlug);
  return config.workingDaysOnly
    ? countWorkingDaysForCompany(startDate, endDate, shiftConfig, companySlug)
    : countCalendarDays(startDate, endDate);
}

export type LeaveFormDocumentProps = {
  mode: "apply" | "view";
  companyName: string;
  companySlug?: string;
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
  companySlug = "xorora",
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
    isApply && form
      ? computeDays(form.leaveType, form.startDate, form.endDate, companySlug)
      : (daysCount ?? 0);
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
        "leave-form-paper mx-auto w-full max-w-[820px] rounded-xl border px-4 py-6 font-sans shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] sm:px-12 sm:py-8",
        className,
      )}
    >
      <div className="text-center">
        <p className="font-mono text-[11px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
          HR document
        </p>
        <h1 className="mt-1 font-bold text-xl tracking-wide text-white">Leave Form</h1>
        <p className="mt-1 text-sm text-[#d7dceb]">HEAD OFFICE, {companyName}, Lahore</p>
      </div>

      <div className="mt-4 flex items-start justify-end gap-8 text-xs text-[#d7dceb]">
        <div className="text-right">
          <div>
            <span className="font-semibold text-white">Print Date:</span> {printDate}
          </div>
          <div className="mt-0.5 italic">Valid for 48 hours only</div>
        </div>
      </div>

      <div className="mt-7 space-y-5 text-sm text-[#eceef5]">
        <div className="grid grid-cols-[4.5rem_1fr] items-end gap-x-3 sm:grid-cols-[72px_1fr]">
          <span className="font-semibold text-white">Name:</span>
          <PaperLine>{employeeName}</PaperLine>
        </div>

        <div className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-8">
          <div className="grid grid-cols-[5.75rem_1fr] items-end gap-x-3 sm:grid-cols-[92px_1fr]">
            <span className="font-semibold text-white">Designation:</span>
            <PaperLine>{designation?.trim() || "\u00A0"}</PaperLine>
          </div>
          <div className="grid grid-cols-[5.75rem_1fr] items-end gap-x-3 sm:grid-cols-[92px_1fr]">
            <span className="font-semibold text-white">Department:</span>
            <PaperLine>{department?.trim() || "\u00A0"}</PaperLine>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-[92px_1fr_36px_1fr_88px_72px] sm:items-end sm:gap-x-3">
          <div className="grid grid-cols-[5.75rem_1fr] items-end gap-x-3 sm:contents">
            <span className="font-semibold text-white">Applied From:</span>
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
                className="leave-form-rule h-7 rounded-none border-0 border-b bg-transparent px-0 text-white shadow-none"
              />
            ) : (
              <PaperLine>{activeStart ? formatLeaveFormDate(activeStart) : "\u00A0"}</PaperLine>
            )}
          </div>
          <div className="grid grid-cols-[5.75rem_1fr] items-end gap-x-3 sm:contents">
            <span className="font-semibold text-white">To:</span>
            {isApply && form && onFormChange ? (
              <DatePicker
                value={form.endDate}
                onChange={(value) => onFormChange((current) => ({ ...current, endDate: value }))}
                className="leave-form-rule h-7 rounded-none border-0 border-b bg-transparent px-0 text-white shadow-none"
              />
            ) : (
              <PaperLine>{activeEnd ? formatLeaveFormDate(activeEnd) : "\u00A0"}</PaperLine>
            )}
          </div>
          <div className="grid grid-cols-[5.75rem_1fr] items-end gap-x-3 sm:contents">
            <span className="font-semibold text-white">Total Days:</span>
            <PaperLine>{activeDays > 0 ? formatLeaveDays(activeDays) : "\u00A0"}</PaperLine>
          </div>
        </div>

        {exceedsBalance ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-destructive text-sm">
            Insufficient {leaveTypeLabel(form?.leaveType ?? "annual")} balance. You have&nbsp;
            {formatLeaveDays(activeBalance?.remaining ?? 0)} day(s) remaining but requested{" "}
            {formatLeaveDays(activeDays)}.
          </p>
        ) : null}

        <div>
          <p className="font-semibold text-white underline underline-offset-2">Type of Leave:</p>
          {probationUnpaidOnly ? (
            <p className="mt-3 text-sm text-[#d7dceb]">
              Emergency unpaid leave (HR approval required). Entitled leave types are not available
              during probation.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-[#d7dceb]">
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
                                onFormChange((current) => ({
                                  ...current,
                                  leaveType: systemType,
                                }))
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

        <div className="grid grid-cols-1 items-start gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr]">
          <span className="pt-0.5 font-semibold text-white">Reason for Leave:</span>
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
          <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr]">
            <span className="font-semibold text-xs text-white">Medical certificate:</span>
            <Input
              required
              value={form.medicalCertificateNote}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  medicalCertificateNote: event.target.value,
                }))
              }
              className="leave-form-rule h-7 rounded-none border-0 border-b bg-transparent px-0 text-white shadow-none"
              placeholder="Certificate reference or details"
            />
          </div>
        ) : null}

        {!isApply && medicalCertificateNote ? (
          <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr]">
            <span className="font-semibold text-xs text-white">Medical certificate:</span>
            <PaperLine>{medicalCertificateNote}</PaperLine>
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-end gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr]">
          <span className="font-semibold text-white">Contact # During Leave:</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
          <span className="font-semibold text-white">Duties transferred to:</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-end gap-x-3">
          <span className="font-semibold text-white">Supervisor comments</span>
          <PaperLine>{"\u00A0"}</PaperLine>
        </div>
      </div>

      <div className="leave-form-rule mt-10 border-t pt-6">
        <h2 className="text-center font-bold text-sm text-white">For Human Resource Department</h2>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="leave-form-rule border px-3 py-2 text-left font-semibold text-white" />
              <th className="leave-form-rule border px-3 py-2 text-center font-semibold text-white">
                Leaves Allowed
              </th>
              <th className="leave-form-rule border px-3 py-2 text-center font-semibold text-white">
                Leave/s Availed
              </th>
              <th className="leave-form-rule border px-3 py-2 text-center font-semibold text-white">
                Leave/s Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {PAPER_HR_LEAVE_ROWS.map(({ label, leaveType: type }) => {
              const balance = balanceFor(type);
              return (
                <tr key={label}>
                  <td className="leave-form-rule border px-3 py-2 font-semibold text-white">
                    {label}
                  </td>
                  <td className="leave-form-rule border px-3 py-2 text-center tabular-nums text-[#eceef5]">
                    {balance ? formatLeaveDays(balance.entitled) : "—"}
                  </td>
                  <td className="leave-form-rule border px-3 py-2 text-center tabular-nums text-[#eceef5]">
                    {balance ? formatLeaveDays(balance.used) : "—"}
                  </td>
                  <td className="leave-form-rule border px-3 py-2 text-center tabular-nums text-[#eceef5]">
                    {balance ? formatLeaveDays(balance.remaining) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 flex items-center gap-8 text-xs text-[#d7dceb]">
          <PaperCheckbox
            checked={activeLeaveType != null && activeLeaveType !== "unpaid"}
            label="Paid"
            disabled
          />
          <PaperCheckbox checked={activeLeaveType === "unpaid"} label="Unpaid" disabled />
        </div>

        <div className="mt-8">
          {PAPER_SIGNATURE_ROWS.map((row) => (
            <div
              key={row.join("-")}
              className={cn(
                "grid gap-6 sm:gap-8",
                row.length === 2 && "grid-cols-2",
                row.length === 3 && "grid-cols-1 sm:grid-cols-3",
              )}
            >
              {row.map((label) => (
                <div key={label}>
                  <PaperLine className="min-h-10">{"\u00A0"}</PaperLine>
                  <p className="mt-2 text-center text-[11px] text-[#d7dceb]">{label}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
