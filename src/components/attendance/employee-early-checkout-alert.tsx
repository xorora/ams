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
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTitle>Early check-out</AlertTitle>
      <AlertDescription>
        You are checking out before {expectedCheckOutTime}. This will be recorded as early leave.
      </AlertDescription>
      <div className="mt-4 flex flex-wrap gap-2 px-4 pb-4">
        <Button variant="destructive" disabled={acting} onClick={onConfirm}>
          Confirm check-out
        </Button>
        <Button variant="outline" disabled={acting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Alert>
  );
}
