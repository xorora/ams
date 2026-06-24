"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatPktDateTime, formatPktIso } from "@/lib/admin/display";
import { toastAsync } from "@/lib/toast";
import { triggerZktecoDeviceSyncAction } from "@/lib/zkteco/actions";
import type { SyncDirection } from "@/lib/zkteco/employee-sync";
import type { SerializedUnmappedDeviceUser, SerializedZktecoDevice } from "@/lib/zkteco/serialize";

type DevicesManagerProps = {
  devices: SerializedZktecoDevice[];
  unmappedUsers: SerializedUnmappedDeviceUser[];
};

function deviceLabel(device: SerializedZktecoDevice): string {
  return device.alias?.trim() || device.serialNumber;
}

function formatSyncAt(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return formatPktDateTime(value);
}

function onlineBadgeVariant(isOnline: boolean): "default" | "secondary" | "destructive" {
  return isOnline ? "default" : "destructive";
}

export function DevicesManager({ devices, unmappedUsers }: DevicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);

  async function handleSync(
    deviceId: string,
    options: { direction?: SyncDirection; force?: boolean },
    label: string,
  ) {
    setSyncingDeviceId(deviceId);

    try {
      await toastAsync(
        triggerZktecoDeviceSyncAction(deviceId, options).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: `${label}…`,
          success: `${label} queued. The device will pick up commands on its next heartbeat.`,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSyncingDeviceId(null);
    }
  }

  const unmappedColumns = useMemo<ColumnDef<SerializedUnmappedDeviceUser>[]>(
    () => [
      {
        accessorKey: "pin",
        header: "PIN",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.pin}</span>,
      },
      {
        accessorKey: "cardNo",
        header: "Card",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.cardNo}</span>,
      },
      {
        accessorKey: "machineEmpName",
        header: "Device name",
        cell: ({ row }) => row.original.machineEmpName?.trim() || "—",
      },
      {
        accessorKey: "machineNo",
        header: "Device SN",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.machineNo ?? "—"}</span>
        ),
      },
      {
        accessorKey: "punchCount",
        header: "Punches",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.punchCount}</span>,
      },
      {
        accessorKey: "lastPunchAt",
        header: "Last punch",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{formatPktIso(row.original.lastPunchAt)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:overflow-hidden">
      {devices.length === 0 ? (
        <Alert>
          <AlertTitle>No devices registered yet</AlertTitle>
          <AlertDescription>
            Configure the K40 cloud server to point at this AMS instance. The device auto-registers
            on its first handshake using its serial number.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid shrink-0 gap-4 md:grid-cols-2">
          {devices.map((device) => {
            const syncing = syncingDeviceId === device.id;
            const busy = syncing || isPending;

            return (
              <Card key={device.id} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {deviceLabel(device)}
                    <Badge variant={onlineBadgeVariant(device.isOnline)}>
                      {device.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {device.serialNumber}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <DetailRow label="Last seen" value={formatSyncAt(device.lastSeenAt)} />
                  <DetailRow label="IP address" value={device.ipAddress ?? "—"} />
                  <DetailRow label="Firmware" value={device.firmwareVersion ?? "—"} />
                  <DetailRow label="Push version" value={device.pushVersion ?? "—"} />
                  <DetailRow label="Last user pull" value={formatSyncAt(device.lastUserSyncAt)} />
                  <DetailRow
                    label="Last employee push"
                    value={formatSyncAt(device.lastEmployeePushAt)}
                  />
                  <DetailRow
                    label="Last company sync"
                    value={formatSyncAt(device.lastCompanySyncAt)}
                  />
                  <DetailRow
                    label="Bootstrap"
                    value={
                      device.bootstrapCompleted
                        ? "Completed"
                        : device.userQueryPending
                          ? "In progress"
                          : "Not started"
                    }
                  />
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 border-t-0 bg-transparent p-4 pt-0">
                  <Button
                    size="sm"
                    disabled={busy || !device.isOnline}
                    onClick={() => handleSync(device.id, { direction: "both" }, "Full sync")}
                  >
                    <RefreshCwIcon className={syncing ? "animate-spin" : undefined} />
                    Sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !device.isOnline}
                    onClick={() => handleSync(device.id, { direction: "pull" }, "Pull from device")}
                  >
                    Pull users
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !device.isOnline}
                    onClick={() => handleSync(device.id, { direction: "push" }, "Push to device")}
                  >
                    Push employees
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || !device.isOnline}
                    onClick={() =>
                      handleSync(device.id, { direction: "both", force: true }, "Force sync")
                    }
                  >
                    Force sync
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col gap-3 md:overflow-hidden">
        <div className="shrink-0">
          <h2 className="font-medium text-base">Unmapped device users</h2>
          <p className="text-muted-foreground text-sm">
            Punches from device PINs that are not linked to an AMS employee. Match or create
            employees with the same employee code, then run a pull sync.
          </p>
        </div>

        <DataTable
          columns={unmappedColumns}
          data={unmappedUsers}
          loading={isPending}
          emptyMessage="All device punches are linked to employees."
          className="md:min-h-0 md:flex-1"
          resetDeps={[unmappedUsers.length]}
        />
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
