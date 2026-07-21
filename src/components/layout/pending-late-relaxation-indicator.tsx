import { countPendingLateRelaxationRequestsCached } from "@/lib/late-relaxation/late-relaxation-service";

/** Server-only: streams into the sidebar late-relaxation indicator. */
export async function PendingLateRelaxationIndicator({
  companyId,
}: {
  companyId: string | null;
}) {
  const count = await countPendingLateRelaxationRequestsCached(companyId);
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} pending late relaxation request${count === 1 ? "" : "s"}`}
      className="size-2 shrink-0 rounded-full bg-destructive"
    />
  );
}
