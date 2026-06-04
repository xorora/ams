"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SerializedEmployee } from "@/lib/admin/serialize";

export type EmployeeFormValues = {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
};

export const emptyEmployeeForm: EmployeeFormValues = {
  employeeCode: "",
  fullName: "",
  email: "",
  department: "",
};

export function employeeToForm(employee: SerializedEmployee): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department ?? "",
  };
}

type EmployeeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: EmployeeFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<EmployeeFormValues>>;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export function EmployeeSheet({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
}: EmployeeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingId ? "Edit employee" : "New employee"}</SheetTitle>
          <SheetDescription>
            {editingId
              ? "Update employee details. Email must stay unique."
              : "Add a new employee. They can sign in with their company email."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-code">Employee code</Label>
            <Input
              id="employee-code"
              required
              value={form.employeeCode}
              onChange={(e) => onFormChange((f) => ({ ...f, employeeCode: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              required
              value={form.fullName}
              onChange={(e) => onFormChange((f) => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              required
              type="email"
              value={form.email}
              onChange={(e) => onFormChange((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={form.department}
              onChange={(e) => onFormChange((f) => ({ ...f, department: e.target.value }))}
            />
          </div>
          <SheetFooter className="flex-row px-0">
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
