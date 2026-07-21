import { countPendingLeaveRequestsCached } from "@/lib/leave/leave-service";

/** Server-only: streams into the sidebar leave-request indicator. */
export async function PendingLeaveIndicator({
  companyId,
}: {
  companyId: string | null;
}) {
  const count = await countPendingLeaveRequestsCached(companyId);
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} pending leave request${count === 1 ? "" : "s"}`}
      className="size-2 shrink-0 rounded-full bg-destructive"
    />
  );
}
