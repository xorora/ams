"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import {
  triggerWdmsAttendanceSyncAction,
  triggerWdmsCompanyPushAction,
  triggerWdmsEmployeeSyncAction,
  triggerWdmsTerminalSyncAction,
} from "@/lib/wdms/actions";
import type {
  SerializedUnmappedPunch,
  SerializedWdmsSyncState,
  SerializedWdmsTerminal,
} from "@/lib/wdms/serialize";

type DevicesManagerProps = {
  devices: SerializedWdmsTerminal[];
  unmappedPunches: SerializedUnmappedPunch[];
  syncState: SerializedWdmsSyncState;
};

function formatSyncAt(value: string | null): string {
  if (!value) {
    return "Never";
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return formatPktDateTime(value);
}

function deviceLabel(device: SerializedWdmsTerminal): string {
  return device.alias?.trim() || device.serialNumber;
}

function isRecentlyActive(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) {
    return false;
  }
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) {
    return false;
  }
  return Date.now() - seen <= 15 * 60 * 1000;
}

export function DevicesManager({ devices, unmappedPunches, syncState }: DevicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refreshPage() {
    startTransition(() => router.refresh());
  }

  async function handleAttendanceSync() {
    try {
      await toastAsync(
        triggerWdmsAttendanceSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pulling attendance from WDMS…",
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
      await toastAsync(
        triggerWdmsEmployeeSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Pulling employees from WDMS…",
          success: (data) =>
            `Employees: ${data.created} created, ${data.updated} updated (${data.fetched} fetched).`,
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
      await toastAsync(
        triggerWdmsTerminalSyncAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data;
        }),
        {
          loading: "Refreshing device status from WDMS…",
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
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:overflow-auto">
      {!syncState.wdmsConfigured ? (
        <Alert variant="destructive">
          <AlertTitle>WDMS not configured</AlertTitle>
          <AlertDescription>
            Set WDMS_BASE_URL, WDMS_USERNAME, and WDMS_PASSWORD in your environment. The K40 pushes
            punches to ZKBio WDMS; AMS pulls from WDMS over the REST API.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>WDMS sync</CardTitle>
            <CardDescription>
              Connected to {syncState.wdmsBaseUrl}. Attendance sync runs daily via cron (Hobby plan
              limit); employee sync runs daily.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Last attendance pull</p>
              <p className="font-medium">{formatSyncAt(syncState.lastAttendanceSync)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last employee pull</p>
              <p className="font-medium">{formatSyncAt(syncState.lastEmployeeSync)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last terminal refresh</p>
              <p className="font-medium">{formatSyncAt(syncState.lastTerminalSync)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last company push</p>
              <p className="font-medium">{formatSyncAt(syncState.lastCompanyPush)}</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={handleCompanyPush} type="button">
              Push company to WDMS
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
          </CardFooter>
        </Card>
      )}

      {devices.length === 0 ? (
        <Alert>
          <AlertTitle>No terminals found</AlertTitle>
          <AlertDescription>
            Terminals appear here after WDMS sync. Ensure the K40 is enrolled in ZKBio WDMS and
            pushing to the lahore-server instance.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => {
            const online = isRecentlyActive(device.lastSeenAt);
            return (
              <Card key={device.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{deviceLabel(device)}</CardTitle>
                      <CardDescription>{device.serialNumber}</CardDescription>
                    </div>
                    <Badge variant={online ? "default" : "secondary"}>
                      {online ? "Recent activity" : "Idle / offline"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Last activity</span>
                    <span>{device.lastSeenAt ? formatPktIso(device.lastSeenAt) : "Unknown"}</span>
                  </div>
                  {device.ipAddress ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">IP</span>
                      <span>{device.ipAddress}</span>
                    </div>
                  ) : null}
                  {device.firmwareVersion ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Firmware</span>
                      <span>{device.firmwareVersion}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {unmappedPunches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Unmapped punches</CardTitle>
            <CardDescription>
              These emp codes punched on the device but do not match an AMS employee. Create or
              update employees with matching employee codes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={unmappedColumns} data={unmappedPunches} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
