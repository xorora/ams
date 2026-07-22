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
    <div className="flex items-baseline justify-between gap-4 border-b border-[#d8dce8]/70 py-3.5 last:border-b-0">
      <span className="text-xs font-medium tracking-[0.08em] text-[#5c6478] uppercase">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#1a1f36]">{value}</span>
    </div>
  );
}

function AmountTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d8dce8]/80 bg-[#f8f9fc] px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.1em] text-[#5c6478] uppercase">{label}</p>
      <p className="mt-2 text-base font-semibold tabular-nums text-[#1a1f36] md:text-lg">{value}</p>
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
        "flex flex-col overflow-hidden rounded-xl border border-[#d8dce8] bg-white",
        className,
      )}
    >
      <div className="border-l-[3px] border-l-[#f26b21] bg-[#010c28] px-4 py-3 font-semibold text-xs tracking-[0.12em] text-white uppercase">
        {title}
      </div>
      <div className="flex flex-1 flex-col px-4 py-2 text-sm md:px-5 md:py-3">{children}</div>
    </div>
  );
}

function XororaStamp({ yearMonth }: { yearMonth: string }) {
  return (
    <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
      <div className="absolute inset-0 rounded-full border-[2.5px] border-[#f26b21]" />
      <div className="absolute inset-[9px] rounded-full border border-[#010c28]" />
      <div className="absolute inset-[16px] rounded-full border border-[#464c9f]/50" />
      <div className="relative z-10 flex flex-col items-center gap-1 px-2 text-center">
        <Image src="/xorora-mark.png" alt="" width={30} height={30} className="rounded-sm" />
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
  const deductionsTotalPkr = slip.incomeTaxPkr + slip.additionalDeductionPkr;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#d8dce8] bg-white shadow-sm",
        className,
      )}
    >
      <div className="relative overflow-hidden bg-[#010c28] px-6 py-8 text-white md:px-10 md:py-10">
        <div className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-[#464c9f]/35" />
        <div className="pointer-events-none absolute -bottom-12 left-16 h-28 w-28 rounded-full bg-[#f26b21]/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <Image
              src="/xorora-logo-white.png"
              alt="Xorora"
              width={180}
              height={40}
              className="h-9 w-auto"
            />
            <p className="text-sm text-[#a8b0c8]">{slip.companyName}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-sm tracking-[0.16em] uppercase">Salary slip</p>
            <p className="mt-2 text-base font-medium text-[#f26b21]">
              {formatYearMonth(slip.yearMonth)}
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#f26b21]" />
      </div>

      <div className="space-y-8 p-6 md:space-y-10 md:p-10">
        <div className="grid gap-6 rounded-2xl border-l-[3px] border-l-[#f26b21] bg-[#f4f5f9] px-5 py-6 text-sm md:grid-cols-2 md:gap-x-12 md:px-8 md:py-7">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] tracking-[0.1em] text-[#5c6478] uppercase">Employee code</p>
              <p className="mt-1.5 font-mono text-base font-medium text-[#1a1f36]">
                {slip.employeeCode}
              </p>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.1em] text-[#5c6478] uppercase">Name</p>
              <p className="mt-1.5 text-base font-medium text-[#1a1f36]">{slip.employeeName}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] tracking-[0.1em] text-[#5c6478] uppercase">Department</p>
              <p className="mt-1.5 text-base font-medium text-[#1a1f36]">{slip.department ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.1em] text-[#5c6478] uppercase">Designation</p>
              <p className="mt-1.5 text-base font-medium text-[#1a1f36]">
                {slip.designation ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-[#010c28] uppercase">
            Salary structure
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <AmountTile label="Gross monthly" value={formatSalaryPkr(slip.grossSalaryPkr)} />
            <AmountTile label="Basic salary" value={formatSalaryPkr(slip.basicSalaryPkr)} />
            <AmountTile label="ADHOC" value={formatSalaryPkr(slip.adhocPkr)} />
            <AmountTile label="HR" value={formatSalaryPkr(slip.hrAllowancePkr)} />
            <AmountTile label="Medical" value={formatSalaryPkr(slip.medicalAllowancePkr)} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <BoxSection title="Attendance">
            <MetricRow label="Working days" value={String(slip.totalDays)} />
            <MetricRow label="Days worked" value={String(slip.earnedDays)} />
            <MetricRow label="Deduct days" value={String(slip.deductDays)} />
            <MetricRow label="Leave deduction" value={formatSalaryPkr(slip.autoLeaveDeductionPkr)} />
            <MetricRow label="Earned salary" value={formatSalaryPkr(slip.calculatedSalaryPkr)} />
          </BoxSection>

          <BoxSection title="Deductions">
            <MetricRow label="Income tax" value={formatSalaryPkr(slip.incomeTaxPkr)} />
            <MetricRow label="Additional" value={formatSalaryPkr(slip.additionalDeductionPkr)} />
            {slip.deductionDetails ? (
              <p className="mt-3 text-[#5c6478] text-xs leading-relaxed">{slip.deductionDetails}</p>
            ) : null}
            <div className="mt-auto border-t border-[#464c9f]/35 pt-3.5 font-semibold text-[#1a1f36]">
              Total: {formatSalaryPkr(deductionsTotalPkr)}
            </div>
          </BoxSection>

          <BoxSection title="Other payable">
            <MetricRow label="Other pay" value={formatSalaryPkr(slip.totalOtherPayPkr)} />
            <MetricRow label="Increment" value={formatSalaryPkr(slip.incrementPkr)} />
            {slip.otherPayableDetails ? (
              <p className="mt-3 text-[#5c6478] text-xs leading-relaxed">
                {slip.otherPayableDetails}
              </p>
            ) : null}
          </BoxSection>
        </div>

        <div className="flex flex-col gap-8 border-t border-[#d8dce8] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 rounded-2xl border-l-[4px] border-l-[#f26b21] bg-[#010c28] px-6 py-6 text-white md:px-8 md:py-7">
            <p className="text-xs tracking-[0.14em] text-[#a8b0c8] uppercase">Net salary payable</p>
            <p className="mt-3 font-semibold text-3xl tabular-nums tracking-tight md:text-4xl">
              {formatSalaryPkr(slip.netSalaryPkr)}
            </p>
            {transferDisplay ? (
              <p className="mt-4 text-sm leading-relaxed text-[#c5cbe0]">
                Transferred — {transferDisplay}
              </p>
            ) : null}
          </div>
          <XororaStamp yearMonth={slip.yearMonth} />
        </div>

        <p className="text-[#5c6478] text-xs leading-relaxed italic">
          This is a computer-generated Xorora salary slip and is valid without a handwritten
          signature.
        </p>
      </div>
    </div>
  );
}
