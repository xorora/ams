import type { LeaveType } from "./types";

/** Leave types shown on the paper form (design only — only Earned/Casual/Sick map to system types). */
export const PAPER_LEAVE_TYPE_ROWS: readonly (readonly string[])[] = [
  ["Earned", "Casual", "Sick Leave", "Out Door", "Short Leave", "Half Day"],
  ["Late Arrival", "Early Left", "Maternity", "Paternity", "Compensatory"],
] as const;

export const PAPER_LEAVE_TYPE_TO_SYSTEM: Record<string, LeaveType> = {
  Earned: "annual",
  Casual: "casual",
  "Sick Leave": "sick",
};

export const SYSTEM_LEAVE_TO_PAPER: Record<LeaveType, string> = {
  annual: "Earned",
  casual: "Casual",
  sick: "Sick Leave",
};

export const PAPER_HR_LEAVE_ROWS: readonly {
  label: string;
  leaveType: LeaveType;
}[] = [
  { label: "SICK LEAVES", leaveType: "sick" },
  { label: "EARNED LEAVES", leaveType: "annual" },
  { label: "CASUAL LEAVES", leaveType: "casual" },
] as const;

export const PAPER_SIGNATURE_ROWS: readonly (readonly string[])[] = [
  ["HR Manager", "MS / Principal"],
  ["CEO / Director", "General Manager", "Executive Director"],
] as const;

export function formatLeavePrintDate(date: Date = new Date()): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}

export function formatLeaveFormDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dd = date.getDate().toString().padStart(2, "0");
  const mon = date.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const yy = date.getFullYear().toString().slice(-2);
  return `${dd}-${mon}-${yy}`;
}
