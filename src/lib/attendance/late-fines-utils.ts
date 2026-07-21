import {
  formatLateCheckInDeadline,
  LATE_FINE_AMOUNT_PKR,
  MONTHLY_LATE_ALLOWANCE,
} from "./constants";

export { LATE_FINE_AMOUNT_PKR, MONTHLY_LATE_ALLOWANCE };

export type MonthlyLateSummary = {
  month: string;
  lateCount: number;
  freeLatesRemaining: number;
  fineableLates: number;
  totalFinePkr: number;
  todayFinePkr: number;
  finesWaived: boolean;
};

export function getCalendarMonth(shiftDate: string): string {
  return shiftDate.slice(0, 7);
}

export function getCalendarMonthDateRange(month: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  const from = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const to = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function summarizeMonthlyLates(
  lateCount: number,
  options: { waived?: boolean } = {},
): Pick<MonthlyLateSummary, "freeLatesRemaining" | "fineableLates" | "totalFinePkr"> {
  const freeLatesRemaining = Math.max(0, MONTHLY_LATE_ALLOWANCE - lateCount);
  if (options.waived) {
    return { freeLatesRemaining, fineableLates: 0, totalFinePkr: 0 };
  }
  const fineableLates = Math.max(0, lateCount - MONTHLY_LATE_ALLOWANCE);
  const totalFinePkr = fineableLates * LATE_FINE_AMOUNT_PKR;
  return { freeLatesRemaining, fineableLates, totalFinePkr };
}

export function lateFineForOccurrence(occurrence: number, waived = false): number {
  if (waived) {
    return 0;
  }
  return occurrence > MONTHLY_LATE_ALLOWANCE ? LATE_FINE_AMOUNT_PKR : 0;
}

export function formatLateFinePkr(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

type LateDay = { shiftDate: string; isLate: boolean };

export function assignLateFinesByShiftDate<T extends LateDay>(
  days: T[],
  waivedMonths?: ReadonlySet<string>,
): Map<string, number> {
  const fines = new Map<string, number>();
  const byMonth = new Map<string, T[]>();

  for (const day of days) {
    if (!day.isLate) {
      continue;
    }
    const month = getCalendarMonth(day.shiftDate);
    const monthDays = byMonth.get(month) ?? [];
    monthDays.push(day);
    byMonth.set(month, monthDays);
  }

  for (const [month, monthDays] of byMonth.entries()) {
    const waived = waivedMonths?.has(month) ?? false;
    const sorted = [...monthDays].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
    sorted.forEach((day, index) => {
      fines.set(day.shiftDate, lateFineForOccurrence(index + 1, waived));
    });
  }

  return fines;
}

export function computeLateFineTotals(
  days: LateDay[],
  waivedMonths?: ReadonlySet<string>,
): {
  fineableLates: number;
  totalFinePkr: number;
} {
  let fineableLates = 0;
  let totalFinePkr = 0;

  const byMonth = new Map<string, LateDay[]>();
  for (const day of days) {
    if (!day.isLate) {
      continue;
    }
    const month = getCalendarMonth(day.shiftDate);
    const monthDays = byMonth.get(month) ?? [];
    monthDays.push(day);
    byMonth.set(month, monthDays);
  }

  for (const [month, monthDays] of byMonth.entries()) {
    const summary = summarizeMonthlyLates(monthDays.length, {
      waived: waivedMonths?.has(month) ?? false,
    });
    fineableLates += summary.fineableLates;
    totalFinePkr += summary.totalFinePkr;
  }

  return { fineableLates, totalFinePkr };
}

export function buildMonthlyLateWarnings(
  summary: MonthlyLateSummary,
  isLateToday: boolean,
): string[] {
  const warnings: string[] = [];

  if (summary.finesWaived) {
    warnings.push(
      `Late fines for ${summary.month} are waived by an approved relaxation. Late marks still appear on your attendance.`,
    );
    if (summary.lateCount > 0) {
      warnings.push(
        `${summary.lateCount} late check-in${summary.lateCount === 1 ? "" : "s"} this month.`,
      );
    }
    return warnings;
  }

  if (summary.lateCount === 0) {
    warnings.push(
      `You have ${MONTHLY_LATE_ALLOWANCE} free late check-ins this month. After that, each late costs ${formatLateFinePkr(LATE_FINE_AMOUNT_PKR)}.`,
    );
    return warnings;
  }

  if (summary.freeLatesRemaining > 0) {
    warnings.push(
      `${summary.lateCount} late check-in${summary.lateCount === 1 ? "" : "s"} this month. ${summary.freeLatesRemaining} free late${summary.freeLatesRemaining === 1 ? "" : "s"} remaining before fines apply.`,
    );
  } else if (!isLateToday) {
    warnings.push(
      `You have used all ${MONTHLY_LATE_ALLOWANCE} free late check-ins this month. Your next late check-in will incur a ${formatLateFinePkr(LATE_FINE_AMOUNT_PKR)} fine.`,
    );
  }

  if (summary.totalFinePkr > 0) {
    warnings.push(
      `Monthly late fines so far: ${formatLateFinePkr(summary.totalFinePkr)} (${summary.fineableLates} fined late${summary.fineableLates === 1 ? "" : "s"}).`,
    );
  }

  if (isLateToday && summary.todayFinePkr > 0) {
    warnings.push(
      `Today's late check-in incurs a ${formatLateFinePkr(summary.todayFinePkr)} fine.`,
    );
  }

  return warnings;
}

export function buildLateCheckInMessage(
  priorMonthlyLates: number,
  isLate: boolean,
  options: { finesWaived?: boolean } = {},
): string {
  if (!isLate) {
    return "Checked in successfully.";
  }

  const occurrence = priorMonthlyLates + 1;
  const base = `Checked in. You are marked late (from ${formatLateCheckInDeadline()}).`;

  if (options.finesWaived) {
    return `${base} This is late #${occurrence} this month — fines are waived by an approved relaxation.`;
  }

  const fine = lateFineForOccurrence(occurrence);
  if (fine > 0) {
    return `${base} This is late #${occurrence} this month — a ${formatLateFinePkr(fine)} fine applies.`;
  }

  const remaining = MONTHLY_LATE_ALLOWANCE - occurrence;
  return `${base} This is late #${occurrence} of ${MONTHLY_LATE_ALLOWANCE} allowed this month (${remaining} free late${remaining === 1 ? "" : "s"} remaining).`;
}
