export type ClearanceDepartmentEntry = {
  remarks: string;
  signature: string;
};

export const CLEARANCE_DEPARTMENTS = [
  "Marketing Department",
  "Media & Promotions",
  "Finance Department",
  "Purchase Department",
  "MIS Department",
  "Chairman Secretariat",
  "Administration Department",
  "Human Resource Department",
] as const;

export const CLEARANCE_FINAL_SIGNATURES = [
  "Office Manager",
  "General Manager",
  "Executive Director",
] as const;

export function emptyClearanceDepartmentEntries(): ClearanceDepartmentEntry[] {
  return CLEARANCE_DEPARTMENTS.map(() => ({
    remarks: "",
    signature: "",
  }));
}
