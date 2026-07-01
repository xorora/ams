"use client";

import Link from "next/link";
import { useState } from "react";
import { SalarySlipDocument } from "@/components/accounting/salary-slip-document";
import { Button } from "@/components/ui/button";
import type { SerializedSalarySlipDetail } from "@/lib/accounting/types";
import { downloadResponseBlob, toastAsync } from "@/lib/toast";

type EmployeeSalarySlipDetailProps = {
  slip: SerializedSalarySlipDetail;
};

export function EmployeeSalarySlipDetail({ slip }: EmployeeSalarySlipDetailProps) {
  const [downloadPending, setDownloadPending] = useState(false);

  async function handleDownloadPdf() {
    setDownloadPending(true);
    try {
      await toastAsync(
        fetch(`/api/salary/slips/${slip.id}/pdf`).then((response) =>
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
        <Button variant="outline" size="sm" render={<Link href="/salary" />}>
          Back to list
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
      </div>

      <SalarySlipDocument slip={slip} maskBank />
    </div>
  );
}
