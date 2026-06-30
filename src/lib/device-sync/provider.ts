import { isZktimeConfigured } from "@/lib/zktime/config";

export function isDeviceSyncConfigured(): boolean {
  return isZktimeConfigured();
}
