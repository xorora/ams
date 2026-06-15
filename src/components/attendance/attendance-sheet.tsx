"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AttendanceStatus } from "@/lib/admin/attendance-service";
import type { SerializedAttendance, SerializedEmployee } from "@/lib/admin/serialize";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type { AttendanceStatus };

export type AttendanceFormValues = {
  employeeId: string;
  shiftDate: string;
  status: AttendanceStatus;
  checkInAt: string;
  checkOutAt: string;
  overtimeStartedAt: string;
  overtimeEndedAt: string;
  overtimeSeconds: string;
  notes: string;
};

export function emptyAttendanceForm(): AttendanceFormValues {
  return {
    employeeId: "",
    shiftDate: formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd"),
    status: "present",
    checkInAt: "",
    checkOutAt: "",
    overtimeStartedAt: "",
    overtimeEndedAt: "",
    overtimeSeconds: "",
    notes: "",
  };
}

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function pktLocalToIso(localValue: string): string | null {
  if (!localValue.trim()) {
    return null;
  }
  const parsed = new Date(`${localValue}:00+05:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function attendanceToForm(record: SerializedAttendance): AttendanceFormValues {
  return {
    employeeId: record.employeeId,
    shiftDate: record.shiftDate,
    status: record.status,
    checkInAt: toDatetimeLocalValue(record.checkInAt),
    checkOutAt: toDatetimeLocalValue(record.checkOutAt),
    overtimeStartedAt: toDatetimeLocalValue(record.overtimeStartedAt),
    overtimeEndedAt: toDatetimeLocalValue(record.overtimeEndedAt),
    overtimeSeconds:
      record.overtimeSeconds != null ? String(Math.floor(record.overtimeSeconds / 60)) : "",
    notes: record.notes ?? "",
  };
}

type AttendanceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  employees: SerializedEmployee[];
  form: AttendanceFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<AttendanceFormValues>>;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export function AttendanceSheet({
  open,
  onOpenChange,
  editingId,
  employees,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
}: AttendanceSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingId ? "Edit attendance" : "New attendance record"}</SheetTitle>
          <SheetDescription>
            {editingId
              ? "Update status, times, and notes for this shift."
              : "Create a manual attendance record for an employee."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-3">
            {!editingId && (
              <div className="flex flex-col gap-1.5">
                <Label>Employee</Label>
                <Select
                  value={form.employeeId || null}
                  onValueChange={(value) =>
                    onFormChange((f) => ({ ...f, employeeId: value ?? "" }))
                  }
                  required
                >
                  <SelectTrigger className="w-full" aria-required>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.fullName} ({e.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editingId && (
              <div className="flex flex-col gap-1.5">
                <Label>Shift date</Label>
                <DatePicker
                  value={form.shiftDate}
                  onChange={(shiftDate) => onFormChange((f) => ({ ...f, shiftDate }))}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  onFormChange((f) => ({ ...f, status: value as AttendanceStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Check-in (PKT)</Label>
              <DateTimePicker
                value={form.checkInAt}
                onChange={(checkInAt) => onFormChange((f) => ({ ...f, checkInAt }))}
                placeholder="Pick check-in"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Check-out (PKT)</Label>
              <DateTimePicker
                value={form.checkOutAt}
                onChange={(checkOutAt) => onFormChange((f) => ({ ...f, checkOutAt }))}
                placeholder="Pick check-out"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendance-notes">Notes</Label>
              <textarea
                id="attendance-notes"
                value={form.notes}
                onChange={(e) => onFormChange((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>

            {editingId && (
              <>
                <Separator />
                <div>
                  <p className="font-medium text-sm">Overtime</p>
                  <p className="text-muted-foreground text-sm">
                    Adjust overtime only when correcting records. Employees cannot edit these
                    fields.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Overtime started (PKT)</Label>
                  <DateTimePicker
                    value={form.overtimeStartedAt}
                    onChange={(overtimeStartedAt) =>
                      onFormChange((f) => ({ ...f, overtimeStartedAt }))
                    }
                    placeholder="Pick overtime start"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Overtime ended (PKT)</Label>
                  <DateTimePicker
                    value={form.overtimeEndedAt}
                    onChange={(overtimeEndedAt) => onFormChange((f) => ({ ...f, overtimeEndedAt }))}
                    placeholder="Pick overtime end"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="overtime-minutes">Overtime elapsed (minutes)</Label>
                  <Input
                    id="overtime-minutes"
                    type="number"
                    min={0}
                    value={form.overtimeSeconds}
                    onChange={(e) =>
                      onFormChange((f) => ({ ...f, overtimeSeconds: e.target.value }))
                    }
                    placeholder="Auto-calculated from start/end if blank"
                  />
                </div>
              </>
            )}
          </div>
          <SheetFooter className="flex-row px-0 pb-0">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
