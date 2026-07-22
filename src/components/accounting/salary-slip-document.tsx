import Image from "next/image";
import { maskTransferDetails } from "@/lib/accounting/bank-mask";
import { formatSalaryPkr, formatYearMonth } from "@/lib/accounting/format";
import type { SerializedSalarySlipDetail } from "@/lib/accounting/types";
import { cn } from "@/lib/utils";

type SalarySlipDocumentProps = {
  slip: SerializedSalarySlipDetail;
  maskBank?: boolean;
  className?: string;
};

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#d8dce8]/80 py-2 last:border-b-0">
      <span className="text-[11px] font-medium tracking-wide text-[#5c6478] uppercase">{label}</span>
      <span className="font-semibold tabular-nums text-[#1a1f36]">{value}</span>
    </div>
  );
}

function BoxSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-[#d8dce8] bg-white",
        className,
      )}
    >
      <div className="border-l-[3px] border-l-[#f26b21] bg-[#010c28] px-3 py-2 font-semibold text-[11px] tracking-wide text-white uppercase">
        {title}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 text-sm">{children}</div>
    </div>
  );
}

function XororaStamp({ yearMonth }: { yearMonth: string }) {
  return (
    <div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center">
      <div className="absolute inset-0 rounded-full border-[2.5px] border-[#f26b21]" />
      <div className="absolute inset-[8px] rounded-full border border-[#010c28]" />
      <div className="absolute inset-[14px] rounded-full border border-[#464c9f]/50" />
      <div className="relative z-10 flex flex-col items-center gap-0.5 px-2 text-center">
        <Image src="/xorora-mark.png" alt="" width={28} height={28} className="rounded-sm" />
        <p className="font-bold text-[10px] tracking-[0.14em] text-[#010c28]">XORORA</p>
        <p className="text-[8px] font-semibold tracking-[0.12em] text-[#f26b21]">AUTHORIZED</p>
        <p className="text-[8px] text-[#5c6478]">{yearMonth}</p>
      </div>
    </div>
  );
}

export function SalarySlipDocument({ slip, maskBank = true, className }: SalarySlipDocumentProps) {
  const transferDisplay = maskBank
    ? maskTransferDetails(slip.transferDetails)
    : slip.transferDetails;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#d8dce8] bg-white shadow-sm",
        className,
      )}
    >
      <div className="relative overflow-hidden bg-[#010c28] px-4 py-5 text-white md:px-6">
        <div className="pointer-events-none absolute -top-8 -right-6 h-28 w-28 rounded-full bg-[#464c9f]/40" />
        <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[#f26b21]/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <Image
              src="/xorora-logo-white.png"
              alt="Xorora"
              width={160}
              height={36}
              className="h-8 w-auto"
            />
            <p className="mt-2 text-xs text-[#a8b0c8]">{slip.companyName}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-sm tracking-[0.14em] uppercase">Salary slip</p>
            <p className="mt-1 text-sm font-medium text-[#f26b21]">
              {formatYearMonth(slip.yearMonth)}
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#f26b21]" />
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 rounded-lg border-l-[3px] border-l-[#f26b21] bg-[#f4f5f9] p-3 text-sm md:grid-cols-2">
          <div>
            <p>
              <span className="text-[#5c6478]">Employee code:</span>{" "}
              <span className="font-mono font-medium text-[#1a1f36]">{slip.employeeCode}</span>
            </p>
            <p className="mt-1">
              <span className="text-[#5c6478]">Name:</span>{" "}
              <span className="font-medium text-[#1a1f36]">{slip.employeeName}</span>
            </p>
          </div>
          <div>
            <p>
              <span className="text-[#5c6478]">Department:</span>{" "}
              <span className="font-medium text-[#1a1f36]">{slip.department ?? "—"}</span>
            </p>
            <p className="mt-1">
              <span className="text-[#5c6478]">Designation:</span>{" "}
              <span className="font-medium text-[#1a1f36]">{slip.designation ?? "—"}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <BoxSection title="Attendance">
            <MetricRow label="Total days" value={String(slip.totalDays)} />
            <MetricRow label="Earned days" value={String(slip.earnedDays)} />
            <MetricRow label="Deduct days" value={String(slip.deductDays)} />
            <MetricRow label="Cal salary" value={formatSalaryPkr(slip.calculatedSalaryPkr)} />
          </BoxSection>

          <BoxSection title="Deductions">
            <MetricRow label="Leave deduct" value={formatSalaryPkr(slip.autoLeaveDeductionPkr)} />
            <MetricRow label="Income tax" value={formatSalaryPkr(slip.incomeTaxPkr)} />
            <MetricRow label="Security" value={formatSalaryPkr(slip.securityDeductionPkr)} />
            <MetricRow label="Additional" value={formatSalaryPkr(slip.additionalDeductionPkr)} />
            {slip.deductionDetails ? (
              <p className="mt-2 text-[#5c6478] text-xs">{slip.deductionDetails}</p>
            ) : null}
            <div className="mt-auto border-t border-[#464c9f]/40 pt-2 font-semibold text-[#1a1f36]">
              Total: {formatSalaryPkr(slip.totalDeductionPkr)}
            </div>
          </BoxSection>

          <BoxSection title="Other payable">
            <MetricRow label="Other pay" value={formatSalaryPkr(slip.totalOtherPayPkr)} />
            <MetricRow label="Increment" value={formatSalaryPkr(slip.incrementPkr)} />
            {slip.otherPayableDetails ? (
              <p className="mt-2 text-[#5c6478] text-xs">{slip.otherPayableDetails}</p>
            ) : null}
          </BoxSection>
        </div>

        <div className="flex flex-col gap-4 border-t border-[#d8dce8] pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 rounded-lg border-l-[4px] border-l-[#f26b21] bg-[#010c28] px-4 py-4 text-white">
            <p className="text-[11px] tracking-[0.14em] text-[#a8b0c8] uppercase">
              Net salary payable
            </p>
            <p className="mt-1 font-semibold text-2xl tabular-nums">
              {formatSalaryPkr(slip.netSalaryPkr)}
            </p>
            {transferDisplay ? (
              <p className="mt-2 text-sm text-[#c5cbe0]">Transferred — {transferDisplay}</p>
            ) : null}
          </div>
          <XororaStamp yearMonth={slip.yearMonth} />
        </div>

        <p className="text-[#5c6478] text-xs italic">
          This is a computer-generated Xorora salary slip and is valid without a handwritten
          signature.
        </p>
      </div>
    </div>
  );
}
