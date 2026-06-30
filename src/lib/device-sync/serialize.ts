import type { wdmsTerminals } from "@/db/schema";
import type { DeviceSyncAdminState } from "@/lib/device-sync/admin";
import type { UnmappedWdmsPunch } from "@/lib/wdms/employee-sync";

export type DeviceTerminal = typeof wdmsTerminals.$inferSelect;

export type SerializedDeviceTerminal = Omit<
  DeviceTerminal,
  "lastSeenAt" | "createdAt" | "updatedAt"
> & {
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedUnmappedPunch = Omit<UnmappedWdmsPunch, "lastPunchAt"> & {
  lastPunchAt: string;
};

export type SerializedDeviceSyncState = DeviceSyncAdminState;

export function serializeDeviceTerminal(device: DeviceTerminal): SerializedDeviceTerminal {
  return {
    ...device,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

export function serializeUnmappedPunch(punch: UnmappedWdmsPunch): SerializedUnmappedPunch {
  return {
    ...punch,
    lastPunchAt: punch.lastPunchAt.toISOString(),
  };
}
