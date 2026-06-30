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
  triggerWdmsAttendanceSyncAction,
  triggerWdmsCompanyPushAction,
  triggerWdmsEmployeeSyncAction,
  triggerWdmsTerminalSyncAction,
} from "@/lib/wdms/actions";
import {
  triggerZktimeAttendanceSyncAction,
  triggerZktimeEmployeeSyncAction,
  triggerZktimePushActiveEmployeesAction,
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
  const isZktime = syncState.provider === "zktime";

  function refreshPage() {
    startTransition(() => router.refresh());
  }

  async function handleAttendanceSync() {
    try {
      const action = isZktime ? triggerZktimeAttendanceSyncAction : triggerWdmsAttendanceSyncAction;

      await toastAsync(
        action().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: isZktime ? "Pulling attendance from ZKTime…" : "Pulling attendance from WDMS…",
          success: (data) => `Synced ${data.inserted} new punch(es) from ${data.fetched} fetched.`,
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleEmployeeSync() {
    try {
      const action = isZktime ? triggerZktimeEmployeeSyncAction : triggerWdmsEmployeeSyncAction;

      await toastAsync(
        action().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: isZktime ? "Pulling employees from ZKTime…" : "Pulling employees from WDMS…",
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
        triggerZktimePushActiveEmployeesAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pushing employees to ZKTime…",
          success: (data) => {
            const failed = data.failures.length;
            const base = `${data.pushed} pushed, ${data.queued} queued.`;
            return failed > 0 ? `${base} ${failed} failed.` : base;
          },
        },
      );
      refreshPage();
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleCompanyPush() {
    try {
      await toastAsync(
        triggerWdmsCompanyPushAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pushing company data to WDMS…",
          success: (data) => {
            const { totals } = data;
            const failed = totals.failures;
            const base = `${totals.employeesPushed} pushed, ${totals.employeesSkipped} skipped across ${data.companies.length} company(ies). ${totals.departmentsCreated} dept(s), ${totals.areasCreated} area(s).`;
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
      const action = isZktime ? triggerZktimeTerminalSyncAction : triggerWdmsTerminalSyncAction;

      await toastAsync(
        action().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: isZktime
            ? "Refreshing device status from ZKTime…"
            : "Refreshing device status from WDMS…",
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
              Set ZKTIME_BASE_URL and ZKTIME_API_KEY, or WDMS_BASE_URL, WDMS_USERNAME, and
              WDMS_PASSWORD in your environment.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex w-full items-center justify-end gap-5">
            {isZktime ? (
              <Button disabled={isPending} onClick={handleEmployeePush} type="button">
                Push employees to ZKTime
              </Button>
            ) : (
              <Button disabled={isPending} onClick={handleCompanyPush} type="button">
                Push company to WDMS
              </Button>
            )}
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
