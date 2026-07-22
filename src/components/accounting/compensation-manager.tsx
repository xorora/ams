"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CompensationTable } from "@/components/accounting/compensation-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadSalarySheetAction } from "@/lib/accounting/actions";
import {
  formatYearMonthShort,
  listRecentYearMonths,
} from "@/lib/accounting/format";
import { compensationListQuery } from "@/lib/accounting/query-params";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";
import { toastAsync } from "@/lib/toast";

type CompensationManagerProps = {
  items: SerializedCompensationListItem[];
  search: string;
  yearMonth: string;
  hasSheetImport: boolean;
};

export function CompensationManager({
  items,
  search,
  yearMonth,
  hasSheetImport,
}: CompensationManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [uploading, setUploading] = useState(false);
  const monthOptions = listRecentYearMonths(18);
  const monthItems = Object.fromEntries(
    monthOptions.map((month) => [month, formatYearMonthShort(month)]),
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const href = `/admin/accounting/compensation${compensationListQuery({
      search: searchInput,
      yearMonth,
    })}`;
    const currentHref = `/admin/accounting/compensation${compensationListQuery({
      search,
      yearMonth,
    })}`;
    if (href === currentHref) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(href);
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, search, yearMonth, router]);

  function navigateMonth(nextYearMonth: string) {
    startTransition(() => {
      router.replace(
        `/admin/accounting/compensation${compensationListQuery({
          search: searchInput,
          yearMonth: nextYearMonth,
        })}`,
      );
    });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("yearMonth", yearMonth);
    formData.set("file", file);

    try {
      await toastAsync(
        uploadSalarySheetAction(formData).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          const data = result.data;
          const unmatched =
            data.unmatched.length > 0
              ? ` Unmatched: ${data.unmatched.join(", ")}.`
              : "";
          return `Imported ${data.imported} employees from ${data.sheetName} (${data.slipsCreated} slips created, ${data.slipsUpdated} updated).${unmatched}`;
        }),
        {
          loading: `Uploading salary sheet for ${formatYearMonthShort(yearMonth)}…`,
          success: (message) => message,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[140px] flex-col gap-1.5">
            <Label htmlFor="compensation-month">Month</Label>
            <Select
              items={monthItems}
              value={yearMonth}
              onValueChange={(value) => {
                if (value) {
                  navigateMonth(value);
                }
              }}
            >
              <SelectTrigger id="compensation-month" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>
                    {formatYearMonthShort(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[220px] max-w-md flex-1 flex-col gap-1.5">
            <Label htmlFor="compensation-search">Search</Label>
            <Input
              id="compensation-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, code, department…"
              disabled={!hasSheetImport}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading || isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload salary sheet"}
          </Button>
        </div>
      </div>

      {!hasSheetImport ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium text-sm">No salary sheet for {formatYearMonthShort(yearMonth)}</p>
          <p className="max-w-md text-muted-foreground text-sm">
            Upload a CNPL-format Excel sheet for this month to show compensation rows and generate
            salary slips.
          </p>
          <Button
            type="button"
            disabled={uploading || isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload salary sheet"}
          </Button>
        </div>
      ) : (
        <CompensationTable
          className="md:min-h-0 md:flex-1"
          items={items}
          yearMonth={yearMonth}
          loading={isPending}
          resetDeps={[search, yearMonth]}
        />
      )}
    </div>
  );
}
