export const dynamic = "force-dynamic";

import { DevicesManager } from "@/components/admin/devices-manager";
import { requireAdminSession } from "@/lib/auth/require-session";
import {
  getDeviceSyncAdminState,
  listDevicesWithSyncState,
  listUnmappedPunches,
} from "@/lib/device-sync/admin";
import { serializeDeviceTerminal, serializeUnmappedPunch } from "@/lib/device-sync/serialize";

export default async function AdminDevicesPage() {
  await requireAdminSession();

  const [{ devices, syncState }, unmappedPunches] = await Promise.all([
    listDevicesWithSyncState(),
    listUnmappedPunches(),
  ]);

  const serializedSyncState = getDeviceSyncAdminState(syncState);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Biometric devices</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {serializedSyncState.provider === "zktime"
            ? "ZKTime owns the K40 connection. AMS pulls attendance and employees through the ZKTime bridge and pushes new hires back for device enrollment."
            : "K40 devices push punches to ZKBio WDMS. AMS pulls attendance and employee data from WDMS and pushes new hires back to WDMS for device enrollment."}
        </p>
      </div>

      <DevicesManager
        devices={devices.map(serializeDeviceTerminal)}
        syncState={serializedSyncState}
        unmappedPunches={unmappedPunches.map(serializeUnmappedPunch)}
      />
    </div>
  );
}
