"use client";

import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatPktDateTime, formatPktIso } from "@/lib/admin/display";
import { toastAsync } from "@/lib/toast";
import {
  refreshZktecoDeviceStatusAction,
  triggerZktecoDeviceSyncAction,
} from "@/lib/zkteco/actions";
import type { DeviceConnectionStatus } from "@/lib/zkteco/device-service";
import type { DeviceSyncSummary, SyncDirection } from "@/lib/zkteco/employee-sync";
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

function onlineBadgeVariant(
  status: DeviceConnectionStatus,
): "default" | "secondary" | "destructive" {
  if (status === "online") {
    return "default";
  }
  if (status === "stale") {
    return "secondary";
  }
  return "destructive";
}

function connectionStatusLabel(status: DeviceConnectionStatus): string {
  if (status === "online") {
    return "Online";
  }
  if (status === "stale") {
    return "Idle";
  }
  return "Offline";
}

function formatSyncSuccess(summary: DeviceSyncSummary): string {
  const parts = [
    `Queued ${summary.totalCommands} command(s)`,
    `${summary.companiesPushed} dept(s)`,
    `${summary.employeesPushed} employee(s)`,
  ];
  if (summary.companyPullQueued || summary.userPullQueued) {
    parts.push("pull from device");
  }
  return `${parts.join(" · ")}. Est. ~${summary.estimatedMinutes} min on device.`;
}

export function DevicesManager({ devices, unmappedUsers }: DevicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [refreshingDeviceId, setRefreshingDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [router]);

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
          return formatSyncSuccess(result.data);
        }),
        {
          loading: `${label}…`,
          success: (message) => message,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSyncingDeviceId(null);
    }
  }

  async function handleRefreshStatus(deviceId: string) {
    setRefreshingDeviceId(deviceId);

    try {
      await toastAsync(
        refreshZktecoDeviceStatusAction(deviceId).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          const { connectionStatus, lastSeenLabel, ipAddress, pendingCommands, requeuedCommands } =
            result.data;
          const status = connectionStatusLabel(connectionStatus);
          const queue = pendingCommands > 0 ? ` · ${pendingCommands} pending command(s)` : "";
          const requeued = requeuedCommands > 0 ? ` · re-queued ${requeuedCommands} stale` : "";
          return `${status} · last heartbeat ${lastSeenLabel}${ipAddress ? ` · ${ipAddress}` : ""}${queue}${requeued}`;
        }),
        {
          loading: "Refreshing status…",
          success: (message) => message,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setRefreshingDeviceId(null);
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
            const refreshing = refreshingDeviceId === device.id;
            const busy = syncing || refreshing || isPending;
            const reachable = device.isOnline;
            const status = device.connectionStatus;

            return (
              <Card key={device.id} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {deviceLabel(device)}
                    <Badge variant={onlineBadgeVariant(status)}>
                      {connectionStatusLabel(status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {device.serialNumber}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <DetailRow label="Last seen" value={device.lastSeenLabel} />
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
                <CardFooter className="flex flex-wrap items-center gap-2 border-t-0 bg-transparent p-4 pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleRefreshStatus(device.id)}
                  >
                    <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
                    Refresh status
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !reachable}
                    onClick={() => handleSync(device.id, { direction: "sync" }, "Sync")}
                  >
                    <RefreshCwIcon className={syncing ? "animate-spin" : undefined} />
                    Sync
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button size="sm" variant="outline" disabled={busy || !reachable} />}
                    >
                      More
                      <ChevronDownIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() =>
                          handleSync(device.id, { direction: "companies" }, "Push companies")
                        }
                      >
                        Push companies only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleSync(device.id, { direction: "employees" }, "Push employees")
                        }
                      >
                        Push employees only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleSync(device.id, { direction: "pull" }, "Pull from device")
                        }
                      >
                        Pull from device only
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {!reachable ? (
                    <p className="w-full text-muted-foreground text-xs">
                      Device has not heartbeated recently. Check K40 cloud server points to
                      ams.xorora.com, then use Refresh status. Status auto-updates every 30s.
                    </p>
                  ) : null}
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
            Punches from device PINs that are not linked to an AMS employee. Run Sync to pull device
            users and push AMS employees, then enroll fingerprints on the K40.
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
