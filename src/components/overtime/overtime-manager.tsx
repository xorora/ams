"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { OvertimeDetailSheet } from "@/components/overtime/overtime-detail-sheet";
import { OvertimeFilters, type OvertimeFiltersState } from "@/components/overtime/overtime-filters";
import { OvertimeTable } from "@/components/overtime/overtime-table";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import { approveOvertimeRequestAction, rejectOvertimeRequestAction } from "@/lib/overtime/actions";
import { overtimeListQuery } from "@/lib/overtime/query-params";
import type { SerializedOvertimeRequest } from "@/lib/overtime/serialize";
import { downloadResponseBlob, toastAsync } from "@/lib/toast";

type OvertimeManagerProps = {
  employees: SerializedEmployee[];
  requests: SerializedOvertimeRequest[];
  filters: OvertimeFiltersState;
};

export function OvertimeManager({
  employees,
  requests,
  filters: initialFilters,
}: OvertimeManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<OvertimeFiltersState>(initialFilters);
  const [actionPending, setActionPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedOvertimeRequest | null>(null);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  function applyFilters(next: OvertimeFiltersState) {
    setFilters(next);
    startTransition(() => {
      router.replace(`/admin/overtime${overtimeListQuery(next)}`);
    });
  }

  async function handleApprove(id: string) {
    setActionPending(true);

    try {
      await toastAsync(
        approveOvertimeRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Approving overtime request…",
          success: "Overtime request approved.",
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  async function handleDownloadPdf(id: string) {
    setDownloadPending(true);

    try {
      await toastAsync(
        fetch(`/api/admin/overtime/${id}/pdf`).then((response) =>
          downloadResponseBlob(response, `overtime-${id}.pdf`),
        ),
        {
          loading: "Downloading overtime slip…",
          success: "Overtime slip PDF downloaded.",
        },
      );
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setDownloadPending(false);
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
        rejectOvertimeRequestAction(id, notes || null).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Rejecting overtime request…",
          success: "Overtime request rejected.",
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="shrink-0">
        <OvertimeFilters filters={filters} employees={employees} onChange={applyFilters} />
      </div>

      <OvertimeTable
        className="md:min-h-0 md:flex-1"
        requests={requests}
        loading={isPending}
        showEmployee
        onView={setViewRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        onDownloadPdf={handleDownloadPdf}
        downloadPending={downloadPending}
        actionPending={actionPending}
        resetDeps={[filters.status, filters.employeeId]}
      />

      <OvertimeDetailSheet
        open={viewRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        request={viewRequest}
      />
    </div>
  );
}
