import { DevicesManager } from "@/components/admin/devices-manager";
import { requireAdminSession } from "@/lib/auth/require-session";
import {
  listUnmappedDeviceUsers,
  listZktecoDevicesWithSyncState,
} from "@/lib/zkteco/employee-sync";
import { serializeUnmappedDeviceUser, serializeZktecoDevice } from "@/lib/zkteco/serialize";

export default async function AdminDevicesPage() {
  await requireAdminSession();

  const [devices, unmappedUsers] = await Promise.all([
    listZktecoDevicesWithSyncState(),
    listUnmappedDeviceUsers(),
  ]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Biometric devices</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Monitor ZKTeco K40 connectivity, trigger employee sync, and review unmapped device users.
        </p>
      </div>

      <DevicesManager
        devices={devices.map(serializeZktecoDevice)}
        unmappedUsers={unmappedUsers.map(serializeUnmappedDeviceUser)}
      />
    </div>
  );
}
