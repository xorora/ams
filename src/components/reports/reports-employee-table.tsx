"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  attendanceStatusBadgeVariant,
  formatAttendanceStatus,
  formatBreakDuration,
  formatPktIso,
  formatShiftDuration,
} from "@/lib/admin/display";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";

type ReportsEmployeeTableProps = {
  days: SerializedEmployeeReport["days"];
};

export function ReportsEmployeeTable({ days }: ReportsEmployeeTableProps) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shift date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Overtime</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Break</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
                No attendance records in this range.
              </TableCell>
            </TableRow>
          ) : (
            days.map((day) => (
              <TableRow key={day.shiftDate}>
                <TableCell className="font-mono text-xs">{day.shiftDate}</TableCell>
                <TableCell>
                  <Badge variant={attendanceStatusBadgeVariant(day.status)} className="capitalize">
                    {formatAttendanceStatus(day.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatPktIso(day.checkInAt)}</TableCell>
                <TableCell className="text-xs">{formatPktIso(day.checkOutAt)}</TableCell>
                <TableCell className="text-xs">
                  {day.overtimeSeconds != null && day.overtimeSeconds > 0 ? (
                    <div>
                      <div>{formatShiftDuration(day.overtimeSeconds)}</div>
                      {day.overtimeStartedAt && (
                        <div className="text-muted-foreground">
                          {formatPktIso(day.overtimeStartedAt)}
                          {day.overtimeEndedAt ? ` → ${formatPktIso(day.overtimeEndedAt)}` : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {day.isLate && <span className="mr-1 text-amber-700">Late</span>}
                  {day.isEarlyLeave && <span className="text-amber-700">Early</span>}
                  {!day.isLate && !day.isEarlyLeave && "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {formatBreakDuration(day.totalBreakSeconds)}
                </TableCell>
                <TableCell className="text-xs capitalize">{day.source}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {day.notes ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
