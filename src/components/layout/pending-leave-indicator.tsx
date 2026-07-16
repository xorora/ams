import { countPendingLeaveRequests } from "@/lib/leave/leave-service";

/** Server-only: streams into the sidebar leave-request indicator. */
export async function PendingLeaveIndicator({
  companyId,
}: {
  companyId: string | null;
}) {
  const count = await countPendingLeaveRequests(companyId);
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar"
    />
  );
}
