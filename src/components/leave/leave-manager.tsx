"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { LeaveFilters, type LeaveFiltersState } from "@/components/leave/leave-filters";
import { LeaveTable } from "@/components/leave/leave-table";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import { approveLeaveRequestAction, rejectLeaveRequestAction } from "@/lib/leave/actions";
import { leaveListQuery } from "@/lib/leave/query-params";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";

type LeaveManagerProps = {
  employees: SerializedEmployee[];
  requests: SerializedLeaveRequest[];
  filters: LeaveFiltersState;
};

export function LeaveManager({ employees, requests, filters: initialFilters }: LeaveManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<LeaveFiltersState>(initialFilters);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [actionPending, setActionPending] = useState(false);

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
    setFeedback(null);

    try {
      const result = await approveLeaveRequestAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Leave request approved." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to approve leave request.",
      });
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
    setFeedback(null);

    try {
      const result = await rejectLeaveRequestAction(id, notes || null);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Leave request rejected." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to reject leave request.",
      });
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback ? <FeedbackBanner type={feedback.type} text={feedback.text} /> : null}

      <LeaveFilters filters={filters} employees={employees} onChange={applyFilters} />

      <LeaveTable
        requests={requests}
        loading={isPending}
        showEmployee
        onApprove={handleApprove}
        onReject={handleReject}
        actionPending={actionPending}
      />
    </div>
  );
}
