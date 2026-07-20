"use client";

import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  type Table as TanstackTable,
  useReactTable,
} from "@tanstack/react-table";
import type * as React from "react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right" | "center";
  }
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground has-[[role=checkbox]]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap has-[[role=checkbox]]:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function isActionsColumn(columnId: string, header: unknown) {
  if (columnId === "actions") {
    return true;
  }
  return typeof header === "string" && header.toLowerCase() === "actions";
}

function columnHeaderLabel(columnId: string, header: unknown): string {
  if (typeof header === "string") {
    return header;
  }
  return columnId.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  resetDeps?: readonly unknown[];
  /** Server-driven pagination: when set, skips client-side row slicing. */
  manualPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
};

function DataTable<TData>({
  columns,
  data,
  loading = false,
  emptyMessage = "No results found.",
  className,
  resetDeps = [],
  manualPagination,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: manualPagination ? Math.max(0, manualPagination.page - 1) : 0,
    pageSize: manualPagination?.pageSize ?? DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    if (manualPagination) {
      setPagination({
        pageIndex: Math.max(0, manualPagination.page - 1),
        pageSize: manualPagination.pageSize,
      });
      return;
    }
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [manualPagination?.page, manualPagination?.pageSize, ...resetDeps]);

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    manualPagination: Boolean(manualPagination),
    pageCount: manualPagination
      ? Math.max(1, Math.ceil(manualPagination.totalItems / manualPagination.pageSize))
      : undefined,
  });

  const rows = table.getRowModel().rows;
  const page = manualPagination?.page ?? pagination.pageIndex + 1;
  const pageSize = manualPagination?.pageSize ?? pagination.pageSize;
  const totalItems = manualPagination?.totalItems ?? data.length;

  return (
    <Card className={cn("flex flex-col gap-0 py-0 md:min-h-0", className)}>
      <div
        className={cn(
          "md:min-h-0 md:flex-1 md:overflow-auto",
          "**:data-[slot=table-head]:sticky **:data-[slot=table-head]:top-0 **:data-[slot=table-head]:z-10",
          "[&_[data-slot=table-header]_[data-slot=table-row]]:bg-card",
          "**:data-[slot=table-head]:bg-card",
          "**:data-[slot=table-head]:shadow-[inset_0_-1px_0_hsl(var(--border))]",
        )}
      >
        <div className="md:hidden">
          {loading ? (
            <p className="px-4 py-6 text-muted-foreground text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-muted-foreground text-sm">{emptyMessage}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => {
                const fieldCells: Cell<TData, unknown>[] = [];
                let actionsCell: Cell<TData, unknown> | undefined;

                for (const cell of row.getVisibleCells()) {
                  if (isActionsColumn(cell.column.id, cell.column.columnDef.header)) {
                    actionsCell = cell;
                  } else {
                    fieldCells.push(cell);
                  }
                }

                return (
                  <li key={row.id} className="flex flex-col gap-3 px-4 py-4">
                    <dl className="grid gap-2">
                      {fieldCells.map((cell) => (
                        <div
                          key={cell.id}
                          className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-start gap-x-3"
                        >
                          <dt className="font-medium text-muted-foreground text-xs leading-5">
                            {columnHeaderLabel(cell.column.id, cell.column.columnDef.header)}
                          </dt>
                          <dd className="min-w-0 break-words text-sm leading-5 whitespace-normal">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {actionsCell ? (
                      <div className="flex items-center justify-end border-t pt-3">
                        {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const align = header.column.columnDef.meta?.align;

                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          align === "right" && "text-right",
                          align === "center" && "text-center",
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const align = cell.column.columnDef.meta?.align;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={(nextPage) => {
          if (manualPagination) {
            manualPagination.onPageChange(nextPage);
            return;
          }
          table.setPageIndex(nextPage - 1);
        }}
        onPageSizeChange={(nextPageSize) => {
          if (manualPagination) {
            manualPagination.onPageSizeChange(nextPageSize);
            return;
          }
          table.setPageSize(nextPageSize);
          table.setPageIndex(0);
        }}
      />
    </Card>
  );
}

export {
  type ColumnDef,
  DataTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TanstackTable,
};
