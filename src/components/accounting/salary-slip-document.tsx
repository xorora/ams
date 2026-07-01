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
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
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
    <div className={cn("flex flex-col rounded-lg border border-border", className)}>
      <div className="border-b border-border bg-muted/40 px-3 py-2 font-semibold text-xs uppercase tracking-wide">
        {title}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 text-sm">{children}</div>
    </div>
  );
}

export function SalarySlipDocument({ slip, maskBank = true, className }: SalarySlipDocumentProps) {
  const transferDisplay = maskBank
    ? maskTransferDetails(slip.transferDetails)
    : slip.transferDetails;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 md:p-6", className)}>
      <div className="border-b border-border pb-4 text-center">
        <p className="font-semibold text-lg">{slip.companyName}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Salary slip — {formatYearMonth(slip.yearMonth)}
        </p>
      </div>

      <div className="mt-4 grid gap-3 border-b border-border pb-4 text-sm md:grid-cols-2">
        <div>
          <p>
            <span className="text-muted-foreground">Employee code:</span>{" "}
            <span className="font-mono">{slip.employeeCode}</span>
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Name:</span> {slip.employeeName}
          </p>
        </div>
        <div>
          <p>
            <span className="text-muted-foreground">Department:</span> {slip.department ?? "—"}
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Designation:</span> {slip.designation ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
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
            <p className="mt-2 text-muted-foreground text-xs">{slip.deductionDetails}</p>
          ) : null}
          <div className="mt-auto border-t border-border pt-2 font-semibold">
            Total: {formatSalaryPkr(slip.totalDeductionPkr)}
          </div>
        </BoxSection>

        <BoxSection title="Other payable">
          <MetricRow label="Other pay" value={formatSalaryPkr(slip.totalOtherPayPkr)} />
          <MetricRow label="Increment" value={formatSalaryPkr(slip.incrementPkr)} />
          {slip.otherPayableDetails ? (
            <p className="mt-2 text-muted-foreground text-xs">{slip.otherPayableDetails}</p>
          ) : null}
        </BoxSection>
      </div>

      <div className="mt-6 space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold text-base uppercase tracking-wide">Net salary</span>
          <span className="font-semibold text-xl tabular-nums">
            {formatSalaryPkr(slip.netSalaryPkr)}
          </span>
        </div>
        {transferDisplay ? (
          <p className="text-muted-foreground text-sm">Transferred — {transferDisplay}</p>
        ) : null}
        <p className="text-muted-foreground text-xs italic">
          This is a computer generated slip and does not require any signature.
        </p>
      </div>
    </div>
  );
}
