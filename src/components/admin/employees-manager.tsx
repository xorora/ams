"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { SerializedEmployee } from "@/lib/admin/serialize";

type ApiError = { error: string; code?: string };

type EmployeeFormState = {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
};

const emptyForm: EmployeeFormState = {
  employeeCode: "",
  fullName: "",
  email: "",
  department: "",
};

function toForm(employee: SerializedEmployee): EmployeeFormState {
  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department ?? "",
  };
}

export function EmployeesManager() {
  const [employees, setEmployees] = useState<SerializedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeInactive) {
        params.set("includeInactive", "true");
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await fetch(`/api/admin/employees?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Failed to load employees");
      }
      const data = (await res.json()) as { employees: SerializedEmployee[] };
      setEmployees(data.employees);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load employees",
      });
    } finally {
      setLoading(false);
    }
  }, [includeInactive, search]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setFeedback(null);
  }

  function openEdit(employee: SerializedEmployee) {
    setEditingId(employee.id);
    setForm(toForm(employee));
    setFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const url = editingId ? `/api/admin/employees/${editingId}` : "/api/admin/employees";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: form.employeeCode,
          fullName: form.fullName,
          email: form.email,
          department: form.department || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Save failed");
      }
      setFeedback({
        type: "success",
        text: editingId ? "Employee updated." : "Employee created.",
      });
      closeForm();
      await loadEmployees();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!window.confirm(`Deactivate ${name}? They will no longer be able to check in.`)) {
      return;
    }
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Deactivate failed");
      }
      setFeedback({ type: "success", text: "Employee deactivated." });
      await loadEmployees();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Deactivate failed",
      });
    }
  }

  async function handleReactivate(id: string) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Reactivate failed");
      }
      setFeedback({ type: "success", text: "Employee reactivated." });
      await loadEmployees();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Reactivate failed",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <Label htmlFor="employee-search">Search</Label>
          <Input
            id="employee-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, code…"
            className="min-w-[220px]"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pb-0.5">
            <Checkbox
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(checked === true)}
            />
            <Label htmlFor="include-inactive" className="font-normal">
              Show inactive
            </Label>
          </div>
          <Button type="button" onClick={openCreate}>
            Add employee
          </Button>
        </div>
      </div>

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit employee" : "New employee"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employee-code">Employee code</Label>
                <Input
                  id="employee-code"
                  required
                  value={form.employeeCode}
                  onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
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

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
                  <TableCell>{employee.fullName}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.department ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.isActive ? "default" : "secondary"}>
                      {employee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(employee)}
                      >
                        Edit
                      </Button>
                      {employee.isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeactivate(employee.id, employee.fullName)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleReactivate(employee.id)}
                        >
                          Reactivate
                        </Button>
                      )}
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
