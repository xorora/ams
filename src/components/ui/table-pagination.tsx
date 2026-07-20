"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPaginationRange, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
};

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const { start, end } = getPaginationRange(page, pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-2",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">
        {totalItems === 0 ? "No results" : `${start}–${end} of ${totalItems}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                if (value) {
                  onPageSizeChange(Number(value));
                }
              }}
            >
              <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            Page {page} of {pageCount}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 md:size-8"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 md:size-8"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
