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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[180px]">
        <Label htmlFor={fromInputId}>From shift date</Label>
        <DatePicker id={fromInputId} value={from} onChange={onFromChange} className="w-full" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[180px]">
        <Label htmlFor={toInputId}>To shift date</Label>
        <DatePicker id={toInputId} value={to} onChange={onToChange} className="w-full" />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-1 lg:items-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
        {showExport ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={onExport}
            disabled={exporting || loading}
          >
            {exporting ? "Exporting…" : "Download Excel"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
