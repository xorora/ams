"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useState } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SerializedAttendance, SerializedEmployee } from "@/lib/admin/serialize";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

type ApiError = { error: string; code?: string };

type AttendanceStatus = "present" | "absent" | "leave";

type AttendanceFormState = {
  employeeId: string;
  shiftDate: string;
  status: AttendanceStatus;
  checkInAt: string;
  checkOutAt: string;
  notes: string;
};

const emptyForm = (): AttendanceFormState => ({
  employeeId: "",
  shiftDate: formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd"),
  status: "present",
  checkInAt: "",
  checkOutAt: "",
  notes: "",
});

function formatPkt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm");
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function pktLocalToIso(localValue: string): string | null {
  if (!localValue.trim()) {
    return null;
  }
  const parsed = new Date(`${localValue}:00+05:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function statusBadgeVariant(
  status: AttendanceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "present":
      return "default";
    case "absent":
      return "destructive";
    case "leave":
      return "outline";
  }
}

export function AttendanceManager() {
  const [employees, setEmployees] = useState<SerializedEmployee[]>([]);
  const [items, setItems] = useState<SerializedAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    employeeId: "",
    status: "" as "" | AttendanceStatus,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AttendanceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/admin/employees");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { employees: SerializedEmployee[] };
    setEmployees(data.employees.filter((e) => e.isActive));
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) {
        params.set("from", filters.from);
      }
      if (filters.to) {
        params.set("to", filters.to);
      }
      if (filters.employeeId) {
        params.set("employeeId", filters.employeeId);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }

      const res = await fetch(`/api/admin/attendance?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Failed to load attendance");
      }
      const data = (await res.json()) as {
        items: SerializedAttendance[];
        total: number;
      };
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load attendance",
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setFeedback(null);
  }

  function openEdit(record: SerializedAttendance) {
    setEditingId(record.id);
    setForm({
      employeeId: record.employeeId,
      shiftDate: record.shiftDate,
      status: record.status,
      checkInAt: toDatetimeLocalValue(record.checkInAt),
      checkOutAt: toDatetimeLocalValue(record.checkOutAt),
      notes: record.notes ?? "",
    });
    setFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    const checkInIso = pktLocalToIso(form.checkInAt);
    const checkOutIso = pktLocalToIso(form.checkOutAt);

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/attendance/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: form.status,
            checkInAt: checkInIso,
            checkOutAt: checkOutIso,
            notes: form.notes || null,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw new Error(err.error ?? "Update failed");
        }
        setFeedback({ type: "success", text: "Attendance updated." });
      } else {
        if (!form.employeeId) {
          throw new Error("Select an employee.");
        }
        const res = await fetch("/api/admin/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: form.employeeId,
            shiftDate: form.shiftDate,
            status: form.status,
            checkInAt: checkInIso,
            checkOutAt: checkOutIso,
            notes: form.notes || null,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw new Error(err.error ?? "Create failed");
        }
        setFeedback({ type: "success", text: "Attendance record created." });
      }

      closeForm();
      await loadAttendance();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkStatus(id: string, status: AttendanceStatus) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/attendance/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Status update failed");
      }
      setFeedback({ type: "success", text: `Marked as ${status}.` });
      await loadAttendance();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Status update failed",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) {
      return;
    }

    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/attendance/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Delete failed");
      }
      setFeedback({ type: "success", text: "Attendance record deleted." });
      await loadAttendance();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-from">From shift date</Label>
          <Input
            id="attendance-from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-to">To shift date</Label>
          <Input
            id="attendance-to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Employee</span>
          <select
            value={filters.employeeId}
            onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
            className="h-9 rounded-lg border bg-background px-3"
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value as "" | AttendanceStatus,
              }))
            }
            className="h-9 rounded-lg border bg-background px-3"
          >
            <option value="">All statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
            Add record
          </Button>
        </div>
      </div>

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit attendance" : "New attendance record"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                {!editingId && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Employee</span>
                    <select
                      required
                      value={form.employeeId}
                      onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                      className="h-9 rounded-lg border bg-background px-3"
                    >
                      <option value="">Select employee</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName} ({e.employeeCode})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!editingId && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Shift date</span>
                    <input
                      required
                      type="date"
                      value={form.shiftDate}
                      onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))}
                      className="h-9 rounded-lg border bg-background px-3"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as AttendanceStatus }))
                    }
                    className="h-9 rounded-lg border bg-background px-3"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Check-in (PKT)</span>
                  <input
                    type="datetime-local"
                    value={form.checkInAt}
                    onChange={(e) => setForm((f) => ({ ...f, checkInAt: e.target.value }))}
                    className="h-9 rounded-lg border bg-background px-3"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Check-out (PKT)</span>
                  <input
                    type="datetime-local"
                    value={form.checkOutAt}
                    onChange={(e) => setForm((f) => ({ ...f, checkOutAt: e.target.value }))}
                    className="h-9 rounded-lg border bg-background px-3"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="rounded-lg border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground text-sm">
        {loading ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}
      </p>

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
                    <Badge variant={statusBadgeVariant(record.status)} className="capitalize">
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatPkt(record.checkInAt)}</TableCell>
                  <TableCell className="text-xs">{formatPkt(record.checkOutAt)}</TableCell>
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
                        onClick={() => openEdit(record)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkStatus(record.id, "present")}
                      >
                        Present
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkStatus(record.id, "absent")}
                      >
                        Absent
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(record.id)}
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
    </div>
  );
}
