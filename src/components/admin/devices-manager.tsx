"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatPktIso } from "@/lib/admin/display";
import type {
  SerializedDeviceSyncState,
  SerializedDeviceTerminal,
  SerializedUnmappedPunch,
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
  unmappedPunches: SerializedUnmappedPunch[];
  syncState: SerializedDeviceSyncState;
};

export function DevicesManager({ unmappedPunches, syncState }: DevicesManagerProps) {
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
          loading: "Pushing companies, departments, and employees to device…",
          success: (data) => {
            const failed = data.employeesFailed;
            const skipped =
              data.skippedUnchanged > 0 ? ` ${data.skippedUnchanged} unchanged (skipped).` : "";
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

  const unmappedColumns: ColumnDef<SerializedUnmappedPunch>[] = [
    {
      accessorKey: "empCode",
      header: "Emp code",
    },
    {
      accessorKey: "machineEmpName",
      header: "Name on device",
      cell: ({ row }) => row.original.machineEmpName ?? "—",
    },
    {
      accessorKey: "machineNo",
      header: "Terminal",
      cell: ({ row }) => row.original.machineNo ?? "—",
    },
    {
      accessorKey: "punchCount",
      header: "Punches",
    },
    {
      accessorKey: "lastPunchAt",
      header: "Last punch",
      cell: ({ row }) => formatPktIso(row.original.lastPunchAt),
    },
  ];

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="shrink-0">
        {!syncState.configured ? (
          <Alert variant="destructive">
            <AlertTitle>Device sync not configured</AlertTitle>
            <AlertDescription>
              Set ZKTIME_BASE_URL and ZKTIME_API_KEY in your environment.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex w-full items-center justify-end gap-5">
            <Button disabled={isPending} onClick={handleEmployeePush} type="button">
              Push all to device
            </Button>
            <Button disabled={isPending} onClick={handleAttendanceSync} type="button">
              <RefreshCwIcon className="size-4" />
              Pull attendance
            </Button>
            <Button
              disabled={isPending}
              onClick={handleEmployeeSync}
              type="button"
              variant="secondary"
            >
              Pull employees
            </Button>
            <Button
              disabled={isPending}
              onClick={handleTerminalSync}
              type="button"
              variant="outline"
            >
              Refresh terminals
            </Button>
          </div>
        )}
      </div>

      {unmappedPunches.length > 0 ? (
        <>
          <div className="shrink-0">
            <h2 className="font-semibold text-lg">Unmapped punches</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              These emp codes punched on the device but do not match an AMS employee. Create or
              update employees with matching employee codes.
            </p>
          </div>
          <DataTable
            className="md:min-h-0 md:flex-1"
            columns={unmappedColumns}
            data={unmappedPunches}
          />
        </>
      ) : null}
    </div>
  );
}
