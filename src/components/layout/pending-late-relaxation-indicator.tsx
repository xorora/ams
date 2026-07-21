import { countPendingLateRelaxationRequests } from "@/lib/late-relaxation/late-relaxation-service";

/** Server-only: streams into the sidebar late-relaxation indicator. */
export async function PendingLateRelaxationIndicator({
  companyId,
}: {
  companyId: string | null;
}) {
  const count = await countPendingLateRelaxationRequests(companyId);
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
