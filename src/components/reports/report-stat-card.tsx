"use client";

type ReportStatCardProps = {
  label: string;
  value: number | string;
};

export function ReportStatCard({ label, value }: ReportStatCardProps) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
