"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { LateRelaxationTable } from "@/components/late-relaxation/late-relaxation-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveLateRelaxationRequestAction,
  rejectLateRelaxationRequestAction,
} from "@/lib/late-relaxation/actions";
import type { SerializedLateRelaxationRequest } from "@/lib/late-relaxation/serialize";
import type { LateRelaxationStatus } from "@/lib/late-relaxation/types";
import { toastAsync } from "@/lib/toast";

const LateRelaxationDetailSheet = dynamic(
  () =>
    import("@/components/late-relaxation/late-relaxation-detail-sheet").then(
      (module) => module.LateRelaxationDetailSheet,
    ),
  { loading: () => null },
);

type LateRelaxationManagerProps = {
  requests: SerializedLateRelaxationRequest[];
  filters: {
    status?: LateRelaxationStatus;
    yearMonth?: string;
  };
  yearMonths: string[];
};

const ALL = "__all__";

function queryString(filters: { status?: LateRelaxationStatus; yearMonth?: string }): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.yearMonth) {
    params.set("yearMonth", filters.yearMonth);
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function LateRelaxationManager({
  requests,
  filters: initialFilters,
  yearMonths,
}: LateRelaxationManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [actionPending, setActionPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedLateRelaxationRequest | null>(null);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const statusItems = useMemo(
    () => ({
      [ALL]: "All statuses",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
    }),
    [],
  );

  const monthItems = useMemo(() => {
    const items: Record<string, string> = { [ALL]: "All months" };
    for (const month of yearMonths) {
      items[month] = month;
    }
    return items;
  }, [yearMonths]);

  function applyFilterPatch(patch: Partial<typeof filters>) {
    setFilters((current) => {
      const next = { ...current, ...patch };
      for (const key of Object.keys(patch) as (keyof typeof filters)[]) {
        if (patch[key] === undefined) {
          delete next[key];
        }
      }
      startTransition(() => {
        router.replace(`/admin/relaxations${queryString(next)}`);
      });
      return next;
    });
  }

  async function handleApprove(id: string) {
    setActionPending(true);
    try {
      await toastAsync(
        approveLateRelaxationRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Approving request…",
          success: "Relaxation approved. Late fines for that month are waived.",
        },
      );
      setViewRequest(null);
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  async function handleReject(id: string) {
    const notes = window.prompt("Optional rejection notes:");
    if (notes === null) {
      return;
    }

    setActionPending(true);
    try {
      await toastAsync(
        rejectLateRelaxationRequestAction(id, notes || null).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Rejecting request…",
          success: "Relaxation request rejected.",
        },
      );
      setViewRequest(null);
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            items={statusItems}
            value={filters.status ?? ALL}
            onValueChange={(value) =>
              applyFilterPatch({
                status: !value || value === ALL ? undefined : (value as LateRelaxationStatus),
              })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select
            items={monthItems}
            value={filters.yearMonth ?? ALL}
            onValueChange={(value) =>
              applyFilterPatch({ yearMonth: !value || value === ALL ? undefined : value })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All months</SelectItem>
              {yearMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(filters.status || filters.yearMonth) && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => applyFilterPatch({ status: undefined, yearMonth: undefined })}
          >
            Clear filters
          </Button>
        )}
      </div>

      <LateRelaxationTable
        className="md:min-h-0 md:flex-1"
        requests={requests}
        showEmployee
        onView={setViewRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        actionPending={actionPending}
      />

      <LateRelaxationDetailSheet
        request={viewRequest}
        open={Boolean(viewRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        showEmployee
        onApprove={handleApprove}
        onReject={handleReject}
        actionPending={actionPending}
      />
    </div>
  );
}
