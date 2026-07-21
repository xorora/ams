"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type EmployeeEarlyCheckoutAlertProps = {
  expectedCheckOutTime: string;
  acting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EmployeeEarlyCheckoutAlert({
  expectedCheckOutTime,
  acting,
  onConfirm,
  onCancel,
}: EmployeeEarlyCheckoutAlertProps) {
  return (
    <Alert className="border-amber-400/40 bg-amber-400/10 text-amber-100">
      <AlertTitle>Early check-out</AlertTitle>
      <AlertDescription>
        You are checking out before {expectedCheckOutTime}. This will be recorded as early leave.
      </AlertDescription>
      <div className="mt-4 flex flex-wrap gap-2 px-4 pb-4">
        <Button variant="destructive" disabled={acting} onClick={onConfirm}>
          Confirm check-out
        </Button>
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-[#eceef5] hover:bg-white/5"
          disabled={acting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </Alert>
  );
}
