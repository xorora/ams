"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

type ReportDateToolbarProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading: boolean;
  exporting: boolean;
  fromInputId: string;
  toInputId: string;
  showExport?: boolean;
};

export function ReportDateToolbar({
  from,
  to,
  onFromChange,
  onToChange,
  onRefresh,
  onExport,
  loading,
  exporting,
  fromInputId,
  toInputId,
  showExport = true,
}: ReportDateToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fromInputId}>From shift date</Label>
        <DatePicker
          id={fromInputId}
          value={from}
          onChange={onFromChange}
          className="min-w-[180px]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={toInputId}>To shift date</Label>
        <DatePicker id={toInputId} value={to} onChange={onToChange} className="min-w-[180px]" />
      </div>
      <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
        Refresh
      </Button>
      {showExport ? (
        <Button type="button" onClick={onExport} disabled={exporting || loading}>
          {exporting ? "Exporting…" : "Download Excel"}
        </Button>
      ) : null}
    </div>
  );
}
