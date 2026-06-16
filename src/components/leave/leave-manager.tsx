"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LeaveDetailSheet } from "@/components/leave/leave-detail-sheet";
import { LeaveFilters, type LeaveFiltersState } from "@/components/leave/leave-filters";
import { LeaveTable } from "@/components/leave/leave-table";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import { approveLeaveRequestAction, rejectLeaveRequestAction } from "@/lib/leave/actions";
import { leaveListQuery } from "@/lib/leave/query-params";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";
import { downloadResponseBlob, toastAsync } from "@/lib/toast";

type LeaveManagerProps = {
  employees: SerializedEmployee[];
  requests: SerializedLeaveRequest[];
  filters: LeaveFiltersState;
};

export function LeaveManager({ employees, requests, filters: initialFilters }: LeaveManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<LeaveFiltersState>(initialFilters);
  const [actionPending, setActionPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedLeaveRequest | null>(null);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  function applyFilters(next: LeaveFiltersState) {
    setFilters(next);
    startTransition(() => {
      router.replace(`/admin/leave${leaveListQuery(next)}`);
    });
  }

  async function handleApprove(id: string) {
    setActionPending(true);

    try {
      await toastAsync(
        approveLeaveRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Approving leave request…",
          success: "Leave request approved.",
        },
      );
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
        fetch(`/api/admin/leave/${id}/pdf`).then((response) =>
          downloadResponseBlob(response, `leave-${id}.pdf`),
        ),
        {
          loading: "Downloading leave PDF…",
          success: "Leave application PDF downloaded.",
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
        rejectLeaveRequestAction(id, notes || null).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Rejecting leave request…",
          success: "Leave request rejected.",
        },
      );
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <div className="shrink-0">
        <LeaveFilters filters={filters} employees={employees} onChange={applyFilters} />
      </div>

      <LeaveTable
        className="min-h-0 flex-1"
        requests={requests}
        loading={isPending}
        showEmployee
        onView={setViewRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        onDownloadPdf={handleDownloadPdf}
        downloadPending={downloadPending}
        actionPending={actionPending}
        resetDeps={[filters.status, filters.leaveType, filters.employeeId]}
      />

      <LeaveDetailSheet
        open={viewRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        request={viewRequest}
        showEmployee
      />
    </div>
  );
}
