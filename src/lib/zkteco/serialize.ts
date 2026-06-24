import type {
  listUnmappedDeviceUsers,
  listZktecoDevicesWithSyncState,
} from "@/lib/zkteco/employee-sync";

type ZktecoDeviceWithSyncState = Awaited<ReturnType<typeof listZktecoDevicesWithSyncState>>[number];

type UnmappedDeviceUser = Awaited<ReturnType<typeof listUnmappedDeviceUsers>>[number];

export type SerializedZktecoDevice = Omit<
  ZktecoDeviceWithSyncState,
  "lastSeenAt" | "createdAt" | "updatedAt"
> & {
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedUnmappedDeviceUser = Omit<UnmappedDeviceUser, "lastPunchAt"> & {
  lastPunchAt: string;
};

export function serializeZktecoDevice(device: ZktecoDeviceWithSyncState): SerializedZktecoDevice {
  return {
    ...device,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

export function serializeUnmappedDeviceUser(
  user: UnmappedDeviceUser,
): SerializedUnmappedDeviceUser {
  return {
    ...user,
    lastPunchAt: user.lastPunchAt.toISOString(),
  };
}
