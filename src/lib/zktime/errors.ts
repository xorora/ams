import { getZktimeBaseUrl } from "@/lib/zktime/config";

function getErrorCause(error: Error): Error | undefined {
  const cause = error.cause;
  return cause instanceof Error ? cause : undefined;
}

function getNetworkErrorCode(error: Error): string | undefined {
  const cause = getErrorCause(error) as (Error & { code?: string }) | undefined;
  return cause?.code;
}

/** Turn ZKTime client/network failures into an admin-actionable message. */
export function formatZktimeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to sync with ZKTime.";
  }

  if (error.message.startsWith("ZKTime request failed")) {
    return error.message;
  }

  if (error.message.startsWith("ZKTime is not configured")) {
    return error.message;
  }

  const networkCode = getNetworkErrorCode(error);
  if (error.message === "fetch failed" || networkCode === "ECONNRESET" || networkCode === "ENOTFOUND") {
    const baseUrl = getZktimeBaseUrl() ?? "ZKTIME_BASE_URL";
    return `Cannot reach the ZKTime bridge at ${baseUrl}. The office server bridge or Tailscale funnel is likely down — restart the bridge on port 8090 and re-run the Tailscale funnel setup.`;
  }

  const cause = getErrorCause(error);
  if (cause?.message) {
    return cause.message;
  }

  return error.message;
}
