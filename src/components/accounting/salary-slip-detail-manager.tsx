"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SalarySlipDocument } from "@/components/accounting/salary-slip-document";
import {
  SalarySlipForm,
  type SalarySlipFormValues,
  salarySlipToForm,
} from "@/components/accounting/salary-slip-form";
import { Button } from "@/components/ui/button";
import { updateSalarySlipAction } from "@/lib/accounting/actions";
import type { SalaryCalculationResult } from "@/lib/accounting/calculations";
import type { SerializedSalarySlipDetail } from "@/lib/accounting/types";
import { downloadResponseBlob, toastAsync } from "@/lib/toast";

type SalarySlipDetailManagerProps = {
  slip: SerializedSalarySlipDetail;
  showFullBank: boolean;
};

function parseAmount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function SalarySlipDetailManager({ slip, showFullBank }: SalarySlipDetailManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SalarySlipFormValues>(salarySlipToForm(slip));
  const [preview, setPreview] = useState<SalaryCalculationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);

  function startEditing() {
    setForm(salarySlipToForm(slip));
    setPreview(null);
    setEditing(true);
  }

  function cancelEditing() {
    setForm(salarySlipToForm(slip));
    setPreview(null);
    setEditing(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await toastAsync(
        updateSalarySlipAction(slip.id, {
          incomeTaxPkr: parseAmount(form.incomeTaxPkr),
          additionalDeductionPkr: parseAmount(form.additionalDeductionPkr),
          deductionDetails: form.deductionDetails.trim() || null,
          otherPayPkr: parseAmount(form.otherPayPkr),
          incrementPkr: parseAmount(form.incrementPkr),
          otherPayableDetails: form.otherPayableDetails.trim() || null,
        }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Updating salary slip…",
          success: "Salary slip updated.",
        },
      );
      setEditing(false);
      router.refresh();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadPending(true);
    try {
      await toastAsync(
        fetch(`/api/admin/accounting/salary-slips/${slip.id}/pdf`).then((response) =>
          downloadResponseBlob(response, `salary-slip-${slip.yearMonth}.pdf`),
        ),
        {
          loading: "Preparing PDF…",
          success: (filename) => `Downloaded ${filename}.`,
        },
      );
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setDownloadPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" render={<Link href="/admin/accounting/salary-slips" />}>
          Back to list
        </Button>
        {!editing ? (
          <>
            <Button type="button" size="sm" onClick={startEditing}>
              Edit slip
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadPending}
            >
              {downloadPending ? "Downloading…" : "Download PDF"}
            </Button>
          </>
        ) : null}
      </div>

      {editing ? (
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          <SalarySlipForm
            employeeId={slip.employeeId}
            yearMonth={slip.yearMonth}
            form={form}
            onFormChange={setForm}
            preview={preview}
            onPreviewChange={setPreview}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={cancelEditing}
            submitLabel="Save changes"
          />
        </div>
      ) : (
        <SalarySlipDocument slip={slip} maskBank={!showFullBank} />
      )}
    </div>
  );
}
