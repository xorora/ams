"use client";

import { useMemo, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatPktIso, formatRelativeTime } from "@/lib/admin/display";
import type {
  SerializedDeviceSyncState,
  SerializedDeviceTerminal,
} from "@/lib/device-sync/serialize";
import { toastAsync } from "@/lib/toast";
import {
  triggerZktimeAttendanceSyncAction,
  triggerZktimeEmployeeSyncAction,
  triggerZktimeOrganizationalPushAction,
  triggerZktimeTerminalSyncAction,
} from "@/lib/zktime/actions";

type DevicesManagerProps = {
  devices: SerializedDeviceTerminal[];
  syncState: SerializedDeviceSyncState;
};

const ONLINE_WITHIN_MS = 30 * 60 * 1000;
const STALE_WITHIN_MS = 24 * 60 * 60 * 1000;

type TerminalPresence = "online" | "stale" | "offline";

function getTerminalPresence(lastSeenAt: string | null, now = Date.now()): TerminalPresence {
  if (!lastSeenAt) {
    return "offline";
  }
  const ageMs = now - new Date(lastSeenAt).getTime();
  if (ageMs <= ONLINE_WITHIN_MS) {
    return "online";
  }
  if (ageMs <= STALE_WITHIN_MS) {
    return "stale";
  }
  return "offline";
}

function terminalPresenceLabel(presence: TerminalPresence): string {
  switch (presence) {
    case "online":
      return "Online";
    case "stale":
      return "Stale";
    case "offline":
      return "Offline";
  }
}

function terminalPresenceBadgeVariant(
  presence: TerminalPresence,
): "default" | "secondary" | "destructive" {
  switch (presence) {
    case "online":
      return "default";
    case "stale":
      return "secondary";
    case "offline":
      return "destructive";
  }
}

function SyncTime({ value }: { value: string | null }) {
  return (
    <div>
      <p className="font-medium">{formatRelativeTime(value)}</p>
      {value ? (
        <p className="text-muted-foreground text-xs" title={formatPktIso(value)}>
          {formatPktIso(value)}
        </p>
      ) : null}
    </div>
  );
}

export function DevicesManager({ devices, syncState }: DevicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refreshPage() {
    startTransition(() => router.refresh());
  }

  async function handleAttendanceSync() {
    try {
      await toastAsync(
        triggerZktimeAttendanceSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pulling attendance from ZKTime…",
          success: (data) =>
            `Synced ${data.inserted} new punch(es), ${data.processed} attendance row(s) updated (${data.fetched} fetched).`,
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleEmployeeSync() {
    try {
      await toastAsync(
        triggerZktimeEmployeeSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pulling employees from ZKTime…",
          success: (data) =>
            `Employees: ${data.created} created, ${data.updated} updated (${data.fetched} fetched).`,
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleEmployeePush() {
    try {
      await toastAsync(
        triggerZktimeOrganizationalPushAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Checking ZKTime and pushing new or changed employees…",
          success: (data) => {
            const failed = data.employeesFailed;
            const skipped =
              data.skippedUnchanged > 0 ? ` ${data.skippedUnchanged} already matched (skipped).` : "";
            if (data.employeesPushed === 0) {
              return `Nothing to push.${skipped}`;
            }
            const base = `${data.employeesPushed} employee(s) pushed across ${data.companies} company(ies) and ${data.departmentsMapped} department group(s). ${data.deviceSyncQueued} queued for device sync.${skipped}`;
            return failed > 0 ? `${base} ${failed} failed.` : base;
          },
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleTerminalSync() {
    try {
      await toastAsync(
        triggerZktimeTerminalSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Refreshing device status from ZKTime…",
          success: (data) => `Updated ${data.count} terminal(s).`,
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  const deviceColumns = useMemo<ColumnDef<SerializedDeviceTerminal>[]>(
    () => [
      {
        accessorKey: "alias",
        header: "Name",
        cell: ({ row }) => row.original.alias?.trim() || "—",
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => getTerminalPresence(row.lastSeenAt),
        cell: ({ row }) => {
          const presence = getTerminalPresence(row.original.lastSeenAt);
          return (
            <Badge variant={terminalPresenceBadgeVariant(presence)}>
              {terminalPresenceLabel(presence)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "serialNumber",
        header: "Serial",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.serialNumber}</span>
        ),
      },
      {
        accessorKey: "ipAddress",
        header: "IP",
        cell: ({ row }) => row.original.ipAddress ?? "—",
      },
      {
        accessorKey: "firmwareVersion",
        header: "Firmware",
        cell: ({ row }) => row.original.firmwareVersion ?? "—",
      },
      {
        accessorKey: "lastSeenAt",
        header: "Last seen",
        cell: ({ row }) => {
          const lastSeenAt = row.original.lastSeenAt;
          if (!lastSeenAt) {
            return "—";
          }
          return (
            <div className="text-xs">
              <p>{formatRelativeTime(lastSeenAt, "—")}</p>
              <p className="text-muted-foreground" title={formatPktIso(lastSeenAt)}>
                {formatPktIso(lastSeenAt)}
              </p>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="shrink-0 space-y-4">
        {!syncState.configured ? (
          <Alert variant="destructive">
            <AlertTitle>Device sync not configured</AlertTitle>
            <AlertDescription>
              Set ZKTIME_BASE_URL and ZKTIME_API_KEY in your environment.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">Last attendance pull</p>
                <SyncTime value={syncState.lastAttendanceSync} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last employee pull</p>
                <SyncTime value={syncState.lastEmployeeSync} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last employee push</p>
                <SyncTime value={syncState.lastEmployeePush} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last terminal refresh</p>
                <SyncTime value={syncState.lastTerminalSync} />
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
              <Button
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleEmployeePush}
                type="button"
              >
                Push changes to device
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleAttendanceSync}
                type="button"
              >
                <RefreshCwIcon className="size-4" />
                Pull attendance
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleEmployeeSync}
                type="button"
                variant="secondary"
              >
                Pull employees
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleTerminalSync}
                type="button"
                variant="outline"
              >
                Refresh terminals
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0">
        <h2 className="font-semibold text-lg">Terminals</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Devices reported by the ZKTime bridge. Use Refresh terminals to update this list.
        </p>
      </div>

      <DataTable
        className="md:min-h-0 md:flex-1"
        columns={deviceColumns}
        data={devices}
        emptyMessage="No terminals yet. Click Refresh terminals to pull them from ZKTime."
      />
    </div>
  );
}
