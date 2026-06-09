"use client";

import type { AttendanceStatus } from "@/components/attendance/attendance-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  formatPktIso,
} from "@/lib/admin/display";
import type { SerializedAttendance } from "@/lib/admin/serialize";

type AttendanceTableProps = {
  items: SerializedAttendance[];
  loading: boolean;
  onEdit: (record: SerializedAttendance) => void;
  onMarkStatus: (id: string, status: AttendanceStatus) => void;
  onDelete: (id: string) => void;
};

export function AttendanceTable({
  items,
  loading,
  onEdit,
  onMarkStatus,
  onDelete,
}: AttendanceTableProps) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shift date</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                No attendance records match your filters.
              </TableCell>
            </TableRow>
          ) : (
            items.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-mono text-xs">{record.shiftDate}</TableCell>
                <TableCell>
                  <div>{record.employeeName}</div>
                  <div className="text-muted-foreground text-xs">{record.employeeCode}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={attendanceStatusBadgeVariant(record.status)}
                    className="capitalize"
                  >
                    {formatAttendanceStatus(record.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatPktIso(record.checkInAt)}</TableCell>
                <TableCell className="text-xs">{formatPktIso(record.checkOutAt)}</TableCell>
                <TableCell className="text-xs">
                  {record.isLate && (
                    <span className="mr-1 text-amber-700 dark:text-amber-300">Late</span>
                  )}
                  {record.isEarlyLeave && (
                    <span className="text-amber-700 dark:text-amber-300">Early</span>
                  )}
                  {!record.isLate && !record.isEarlyLeave && "—"}
                </TableCell>
                <TableCell className="text-xs capitalize">{record.source}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(record)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onMarkStatus(record.id, "present")}
                    >
                      Present
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onMarkStatus(record.id, "absent")}
                    >
                      Absent
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(record.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
