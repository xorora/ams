import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, leaveRequests } from "@/db/schema";
import { getCalendarMonthDateRange } from "@/lib/attendance/late-fines-utils";
import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import type { LeaveType } from "@/lib/leave/types";
import { countCalendarDays, isWeekendDate } from "@/lib/leave/working-days";

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type AttendanceStatus = "present" | "absent" | "leave" | "weekend_off";

export type AttendanceDayForSalary = {
  shiftDate: string;
  status: AttendanceStatus;
};

export type ApprovedLeaveForSalary = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  status: "approved";
};

export type CompensationProfile = {
  grossSalaryPkr: number;
  fixedSecurityDeductionPkr: number;
  fixedOtherPayPkr: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
};

export type SlipAdjustments = {
  incomeTaxPkr: number;
  additionalDeductionPkr: number;
  otherPayPkr: number;
  incrementPkr: number;
};

export type SalaryDayCounts = {
  totalDays: number;
  earnedDays: number;
  deductDays: number;
};

export type SalaryCalculationResult = SalaryDayCounts & {
  calculatedSalaryPkr: number;
  autoLeaveDeductionPkr: number;
  securityDeductionPkr: number;
  totalOtherPayPkr: number;
  totalDeductionPkr: number;
  netSalaryPkr: number;
  transferDetails: string | null;
};

export type YearMonthRange = SalaryDayCounts & {
  from: string;
  to: string;
};

export function validateYearMonth(yearMonth: string): yearMonth is `${number}-${string}` {
  return YEAR_MONTH_PATTERN.test(yearMonth);
}

export function getYearMonthRange(yearMonth: string): YearMonthRange {
  if (!validateYearMonth(yearMonth)) {
    throw new Error("yearMonth must be in YYYY-MM format.");
  }

  const { from, to } = getCalendarMonthDateRange(yearMonth);
  const totalDays = countCalendarDays(from, to);

  return { from, to, totalDays, earnedDays: 0, deductDays: 0 };
}

/** Approved leave type covering a shift date, or null when none applies. */
export function getApprovedLeaveTypeForDate(
  shiftDate: string,
  approvedLeaves: ApprovedLeaveForSalary[],
): LeaveType | null {
  for (const leave of approvedLeaves) {
    if (shiftDate < leave.startDate || shiftDate > leave.endDate) {
      continue;
    }

    const config = LEAVE_ENTITLEMENTS[leave.leaveType];
    if (config.workingDaysOnly && isWeekendDate(shiftDate)) {
      continue;
    }

    return leave.leaveType;
  }

  return null;
}

export function countSalaryDays(
  attendanceRows: AttendanceDayForSalary[],
  approvedLeaves: ApprovedLeaveForSalary[],
): Pick<SalaryDayCounts, "earnedDays" | "deductDays"> {
  let earnedDays = 0;
  let deductDays = 0;

  for (const row of attendanceRows) {
    switch (row.status) {
      case "present":
        earnedDays += 1;
        break;
      case "absent":
        deductDays += 1;
        break;
      case "leave": {
        const leaveType = getApprovedLeaveTypeForDate(row.shiftDate, approvedLeaves);
        if (leaveType === "unpaid") {
          deductDays += 1;
        } else {
          earnedDays += 1;
        }
        break;
      }
      case "weekend_off":
        break;
    }
  }

  return { earnedDays, deductDays };
}

export function roundSalaryPkr(amount: number): number {
  return Math.round(amount);
}

export function computeCalculatedSalaryPkr(
  grossSalaryPkr: number,
  totalDays: number,
  earnedDays: number,
): number {
  if (totalDays <= 0) {
    return 0;
  }
  return roundSalaryPkr((grossSalaryPkr / totalDays) * earnedDays);
}

export function computeAutoLeaveDeductionPkr(
  grossSalaryPkr: number,
  totalDays: number,
  deductDays: number,
): number {
  if (totalDays <= 0) {
    return 0;
  }
  return roundSalaryPkr((grossSalaryPkr / totalDays) * deductDays);
}

function formatTransferDetails(
  bankName?: string | null,
  bankAccountNumber?: string | null,
): string | null {
  const name = bankName?.trim();
  const account = bankAccountNumber?.trim();

  if (name && account) {
    return `${name} - ${account}`;
  }
  if (name) {
    return name;
  }
  if (account) {
    return account;
  }
  return null;
}

export function computeSalaryAmounts(
  compensation: CompensationProfile,
  adjustments: SlipAdjustments,
  dayCounts: SalaryDayCounts,
): SalaryCalculationResult {
  const {
    grossSalaryPkr,
    fixedSecurityDeductionPkr,
    fixedOtherPayPkr,
    bankName,
    bankAccountNumber,
  } = compensation;
  const { incomeTaxPkr, additionalDeductionPkr, otherPayPkr, incrementPkr } = adjustments;
  const { totalDays, earnedDays, deductDays } = dayCounts;

  const calculatedSalaryPkr = computeCalculatedSalaryPkr(grossSalaryPkr, totalDays, earnedDays);
  const autoLeaveDeductionPkr = computeAutoLeaveDeductionPkr(grossSalaryPkr, totalDays, deductDays);
  const securityDeductionPkr = fixedSecurityDeductionPkr;
  const totalOtherPayPkr = fixedOtherPayPkr + otherPayPkr;
  const totalDeductionPkr =
    autoLeaveDeductionPkr + incomeTaxPkr + securityDeductionPkr + additionalDeductionPkr;
  const netSalaryPkr = calculatedSalaryPkr + totalOtherPayPkr + incrementPkr - totalDeductionPkr;

  return {
    totalDays,
    earnedDays,
    deductDays,
    calculatedSalaryPkr,
    autoLeaveDeductionPkr,
    securityDeductionPkr,
    totalOtherPayPkr,
    totalDeductionPkr,
    netSalaryPkr,
    transferDetails: formatTransferDetails(bankName, bankAccountNumber),
  };
}

export function computeSalaryFromAttendance(
  yearMonth: string,
  compensation: CompensationProfile,
  adjustments: SlipAdjustments,
  attendanceRows: AttendanceDayForSalary[],
  approvedLeaves: ApprovedLeaveForSalary[],
): SalaryCalculationResult {
  const { from, to, totalDays } = getYearMonthRange(yearMonth);
  const monthAttendance = attendanceRows.filter(
    (row) => row.shiftDate >= from && row.shiftDate <= to,
  );
  const monthLeaves = approvedLeaves.filter(
    (leave) => leave.startDate <= to && leave.endDate >= from,
  );
  const { earnedDays, deductDays } = countSalaryDays(monthAttendance, monthLeaves);

  return computeSalaryAmounts(compensation, adjustments, {
    totalDays,
    earnedDays,
    deductDays,
  });
}

export async function loadAttendanceForSalaryMonth(
  employeeId: string,
  yearMonth: string,
): Promise<AttendanceDayForSalary[]> {
  const { from, to } = getYearMonthRange(yearMonth);

  return db
    .select({
      shiftDate: attendanceDays.shiftDate,
      status: attendanceDays.status,
    })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        gte(attendanceDays.shiftDate, from),
        lte(attendanceDays.shiftDate, to),
      ),
    );
}

export async function loadApprovedLeavesForSalaryMonth(
  employeeId: string,
  yearMonth: string,
): Promise<ApprovedLeaveForSalary[]> {
  const { from, to } = getYearMonthRange(yearMonth);

  const rows = await db
    .select({
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
    })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, to),
        gte(leaveRequests.endDate, from),
      ),
    );

  return rows.map((row) => ({
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    status: "approved" as const,
  }));
}

export async function computeSalaryForEmployeeMonth(
  employeeId: string,
  yearMonth: string,
  compensation: CompensationProfile,
  adjustments: SlipAdjustments,
): Promise<SalaryCalculationResult> {
  const [attendance, approvedLeaves] = await Promise.all([
    loadAttendanceForSalaryMonth(employeeId, yearMonth),
    loadApprovedLeavesForSalaryMonth(employeeId, yearMonth),
  ]);

  return computeSalaryFromAttendance(
    yearMonth,
    compensation,
    adjustments,
    attendance,
    approvedLeaves,
  );
}
