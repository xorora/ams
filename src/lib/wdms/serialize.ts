import type { wdmsTerminals } from "@/db/schema";
import type { UnmappedWdmsPunch } from "@/lib/wdms/employee-sync";

export type WdmsTerminal = typeof wdmsTerminals.$inferSelect;

export type SerializedWdmsTerminal = Omit<
  WdmsTerminal,
  "lastSeenAt" | "createdAt" | "updatedAt"
> & {
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedUnmappedPunch = Omit<UnmappedWdmsPunch, "lastPunchAt"> & {
  lastPunchAt: string;
};

export type SerializedWdmsSyncState = {
  lastAttendanceSync: string | null;
  lastEmployeeSync: string | null;
  lastTerminalSync: string | null;
  lastCompanyPush: string | null;
  wdmsConfigured: boolean;
  wdmsBaseUrl: string | null;
};

export function serializeWdmsTerminal(device: WdmsTerminal): SerializedWdmsTerminal {
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
