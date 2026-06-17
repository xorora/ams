"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toastSuccess } from "@/lib/toast";

export function NewEmployeeCodeToast() {
  const searchParams = useSearchParams();
  const newEmployeeCode = searchParams.get("newEmployeeCode");

  useEffect(() => {
    if (!newEmployeeCode) {
      return;
    }

    toastSuccess(`Your employee number is ${newEmployeeCode}. Save it for future reference.`);
  }, [newEmployeeCode]);

  return null;
}
