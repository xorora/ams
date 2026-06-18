"use client";

import { useEffect, useRef } from "react";
import { formatShiftDuration } from "@/lib/admin/display";
import {
  formatOvertimeSlipDate,
  formatOvertimeSlipTime,
  formatOvertimeTotalHours,
} from "@/lib/attendance/overtime-form-layout";
import { cn } from "@/lib/utils";

export type OvertimeFormValues = {
  workDescription: string;
};

function PaperLine({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-7 border-black border-b pb-1 text-sm leading-7", className)}>
      {children}
    </div>
  );
}

function PaperWorkField({
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
      <div className="min-h-14 border-black border-b pb-1 text-sm leading-7 whitespace-pre-wrap">
        {value.trim() || "\u00A0"}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      required
      rows={2}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder="Describe the work done during overtime"
      className="min-h-14 w-full resize-none overflow-hidden border-0 border-black border-b bg-transparent px-0 py-0 text-sm leading-7 outline-none"
    />
  );
}

type OvertimeFormDocumentProps = {
  mode: "apply" | "view";
  employeeName: string;
  designation?: string | null;
  shiftDate: string;
  checkInAt: string;
  checkOutAt: string;
  overtimeStartedAt: string;
  overtimeEndedAt: string;
  overtimeSeconds: number;
  form?: OvertimeFormValues;
  onFormChange?: (updater: (values: OvertimeFormValues) => OvertimeFormValues) => void;
  workDescription?: string;
};

export function OvertimeFormDocument({
  mode,
  employeeName,
  designation,
  shiftDate,
  checkInAt,
  checkOutAt,
  overtimeStartedAt,
  overtimeEndedAt,
  overtimeSeconds,
  form,
  onFormChange,
  workDescription,
}: OvertimeFormDocumentProps) {
  const readOnly = mode === "view";
  const description = readOnly ? (workDescription ?? "") : (form?.workDescription ?? "");

  return (
    <div className="mx-auto w-full max-w-[640px] border border-black bg-white p-6 text-black shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1" />
        <div className="border border-black px-4 py-2 font-bold text-sm uppercase tracking-wide">
          Over Time Slip
        </div>
        <div className="flex flex-1 flex-col items-end gap-1">
          <div className="flex items-end gap-2 text-sm">
            <span className="font-semibold">DATE:</span>
            <PaperLine className="min-w-[72px]">{formatOvertimeSlipDate(shiftDate)}</PaperLine>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-[120px_1fr] items-end gap-3 text-sm">
          <span className="font-semibold">Name of Employee:</span>
          <PaperLine>{employeeName}</PaperLine>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-end gap-3 text-sm">
          <span className="font-semibold">Designation:</span>
          <PaperLine>{designation?.trim() || "\u00A0"}</PaperLine>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="grid grid-cols-[88px_1fr] items-end gap-3">
            <span className="font-semibold">Arrival Time:</span>
            <PaperLine>{formatOvertimeSlipTime(checkInAt)}</PaperLine>
          </div>
          <div className="grid grid-cols-[88px_1fr] items-end gap-3">
            <span className="font-semibold">Leaving Time:</span>
            <PaperLine>{formatOvertimeSlipTime(checkOutAt)}</PaperLine>
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-start gap-3 text-sm">
          <span className="font-semibold">Work done in Over Time:</span>
          <PaperWorkField
            value={description}
            readOnly={readOnly}
            onChange={
              readOnly || !onFormChange
                ? undefined
                : (value) => onFormChange((current) => ({ ...current, workDescription: value }))
            }
          />
        </div>

        <div className="grid grid-cols-[120px_1fr_24px_1fr] items-end gap-3 text-sm">
          <span className="font-semibold">Time spent From:</span>
          <PaperLine>{formatOvertimeSlipTime(overtimeStartedAt)}</PaperLine>
          <span className="font-semibold">To:</span>
          <PaperLine>{formatOvertimeSlipTime(overtimeEndedAt)}</PaperLine>
        </div>

        <div className="grid grid-cols-[120px_auto_auto_1fr] items-end gap-3 text-sm">
          <span className="font-semibold">Total Time:</span>
          <PaperLine className="min-w-[48px]">
            {formatOvertimeTotalHours(overtimeSeconds)}
          </PaperLine>
          <span>Hours.</span>
          <span className="text-muted-foreground text-xs">
            ({formatShiftDuration(overtimeSeconds)} tracked)
          </span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs">
        {["Approved By,", "Recommended By,", "Employee Signature,"].map((label) => (
          <div key={label}>
            <div className="mb-6 border-black border-b" />
            <div>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
