import { getZktimeBaseUrl, isZktimeConfigured } from "@/lib/zktime/config";
import {
  listDevicesWithSyncState as listZktimeDevicesWithSyncState,
  listUnmappedPunches as listZktimeUnmappedPunches,
} from "@/lib/zktime/employee-sync";

export type DeviceSyncAdminState = {
  lastAttendanceSync: string | null;
  lastEmployeeSync: string | null;
  lastTerminalSync: string | null;
  lastEmployeePush: string | null;
  configured: boolean;
  baseUrl: string | null;
};

export async function listDevicesWithSyncState() {
  return listZktimeDevicesWithSyncState();
}

export async function listUnmappedPunches() {
  return listZktimeUnmappedPunches();
}

export function getDeviceSyncAdminState(syncState: {
  lastAttendanceSync: string | null;
  lastEmployeeSync: string | null;
  lastTerminalSync: string | null;
  lastEmployeePush?: string | null;
}): DeviceSyncAdminState {
  return {
    lastAttendanceSync: syncState.lastAttendanceSync,
    lastEmployeeSync: syncState.lastEmployeeSync,
    lastTerminalSync: syncState.lastTerminalSync,
    lastEmployeePush: syncState.lastEmployeePush ?? null,
    configured: isZktimeConfigured(),
    baseUrl: getZktimeBaseUrl() ?? null,
  };
}
