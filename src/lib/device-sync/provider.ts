import { isWdmsConfigured } from "@/lib/wdms/config";
import { isZktimeConfigured } from "@/lib/zktime/config";

export type DeviceSyncProvider = "zktime" | "wdms";

export function getDeviceSyncProvider(): DeviceSyncProvider | null {
  if (isZktimeConfigured()) {
    return "zktime";
  }
  if (isWdmsConfigured()) {
    return "wdms";
  }
  return null;
}

export function isDeviceSyncConfigured(): boolean {
  return getDeviceSyncProvider() !== null;
}
