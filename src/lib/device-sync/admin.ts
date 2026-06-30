import { getDeviceSyncProvider } from "@/lib/device-sync/provider";
import { getWdmsBaseUrl } from "@/lib/wdms/config";
import {
  listDevicesWithSyncState as listWdmsDevicesWithSyncState,
  listUnmappedPunches as listWdmsUnmappedPunches,
} from "@/lib/wdms/employee-sync";
import { getZktimeBaseUrl } from "@/lib/zktime/config";
import {
  listDevicesWithSyncState as listZktimeDevicesWithSyncState,
  listUnmappedPunches as listZktimeUnmappedPunches,
} from "@/lib/zktime/employee-sync";

export type DeviceSyncAdminState = {
  lastAttendanceSync: string | null;
  lastEmployeeSync: string | null;
  lastTerminalSync: string | null;
  lastCompanyPush: string | null;
  lastEmployeePush: string | null;
  provider: ReturnType<typeof getDeviceSyncProvider>;
  configured: boolean;
  baseUrl: string | null;
};

export async function listDevicesWithSyncState() {
  const provider = getDeviceSyncProvider();
  if (provider === "zktime") {
    return listZktimeDevicesWithSyncState();
  }
  return listWdmsDevicesWithSyncState();
}

export async function listUnmappedPunches() {
  const provider = getDeviceSyncProvider();
  if (provider === "zktime") {
    return listZktimeUnmappedPunches();
  }
  return listWdmsUnmappedPunches();
}

export function getDeviceSyncAdminState(syncState: {
  lastAttendanceSync: string | null;
  lastEmployeeSync: string | null;
  lastTerminalSync: string | null;
  lastCompanyPush?: string | null;
  lastEmployeePush?: string | null;
}): DeviceSyncAdminState {
  const provider = getDeviceSyncProvider();

  return {
    lastAttendanceSync: syncState.lastAttendanceSync,
    lastEmployeeSync: syncState.lastEmployeeSync,
    lastTerminalSync: syncState.lastTerminalSync,
    lastCompanyPush: syncState.lastCompanyPush ?? null,
    lastEmployeePush: syncState.lastEmployeePush ?? null,
    provider,
    configured: provider !== null,
    baseUrl:
      provider === "zktime"
        ? (getZktimeBaseUrl() ?? null)
        : provider === "wdms"
          ? (getWdmsBaseUrl() ?? null)
          : null,
  };
}
