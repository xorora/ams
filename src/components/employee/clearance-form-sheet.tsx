"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SerializedEmployee } from "@/lib/admin/serialize";
import {
  CLEARANCE_DEPARTMENTS,
  type ClearanceDepartmentEntry,
  emptyClearanceDepartmentEntries,
} from "@/lib/clearance/clearance-form-layout";

export type ClearanceFormValues = {
  departmentEntries: ClearanceDepartmentEntry[];
};

export function employeeToClearanceForm(): ClearanceFormValues {
  return {
    departmentEntries: emptyClearanceDepartmentEntries(),
  };
}

type ClearanceFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: SerializedEmployee | null;
  form: ClearanceFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<ClearanceFormValues>>;
  generating: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onCancel: () => void;
};

export function ClearanceFormSheet({
  open,
  onOpenChange,
  employee,
  form,
  onFormChange,
  generating,
  onPreview,
  onDownload,
  onCancel,
}: ClearanceFormSheetProps) {
  function updateDepartmentEntry(index: number, patch: Partial<ClearanceDepartmentEntry>): void {
    onFormChange((current) => ({
      departmentEntries: current.departmentEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Employee clearance form</SheetTitle>
          <SheetDescription>
            Enter departmental remarks and signatures, then preview or download the printable PDF.
          </SheetDescription>
        </SheetHeader>

        {employee ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Employee code</p>
                <p className="font-mono text-sm">{employee.employeeCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="text-sm">{employee.fullName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Department</p>
                <p className="text-sm">{employee.department ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Designation</p>
                <p className="text-sm">{employee.designation ?? "—"}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-5">
              {CLEARANCE_DEPARTMENTS.map((department, index) => {
                const entry = form.departmentEntries[index] ?? { remarks: "", signature: "" };

                return (
                  <div key={department} className="space-y-3 rounded-lg border p-4">
                    <p className="font-medium text-sm">
                      {index + 1}. {department}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor={`clearance-remarks-${index}`}>Remarks</Label>
                      <textarea
                        id={`clearance-remarks-${index}`}
                        value={entry.remarks}
                        onChange={(event) =>
                          updateDepartmentEntry(index, { remarks: event.target.value })
                        }
                        rows={2}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Department remarks"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`clearance-signature-${index}`}>Signature</Label>
                      <Input
                        id={`clearance-signature-${index}`}
                        value={entry.signature}
                        onChange={(event) =>
                          updateDepartmentEntry(index, { signature: event.target.value })
                        }
                        placeholder="Signatory name"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-muted-foreground text-xs">
              Office Manager, General Manager, and Executive Director signature lines are left blank
              on the PDF for signing after printing.
            </p>
          </div>
        ) : null}

        <SheetFooter className="border-t px-4 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={generating}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onPreview} disabled={generating}>
            {generating ? "Generating…" : "Preview PDF"}
          </Button>
          <Button type="button" onClick={onDownload} disabled={generating}>
            {generating ? "Generating…" : "Download PDF"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
