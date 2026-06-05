import { addMonths, differenceInDays, isAfter, parse, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export const DEFAULT_PROBATION_PERIOD_MONTHS = 3;
const DATE_FORMAT = "yyyy-MM-dd";

export type ProbationFields = {
  probationEnabled: boolean;
  probationCompleted: boolean;
  probationStartDate: string | null;
  probationPeriodMonths: number;
};

export function getTodayPkt(): string {
  return formatInTimeZone(new Date(), BUSINESS_TIMEZONE, DATE_FORMAT);
}

function parseDate(value: string): Date {
  return startOfDay(parse(value, DATE_FORMAT, new Date()));
}

export function getProbationEndDate(startDate: string, periodMonths: number): Date {
  return addMonths(parseDate(startDate), periodMonths);
}

export function formatProbationEndDate(startDate: string, periodMonths: number): string {
  const end = getProbationEndDate(startDate, periodMonths);
  return formatInTimeZone(end, BUSINESS_TIMEZONE, DATE_FORMAT);
}

export function getProbationTotalDays(startDate: string, periodMonths: number): number {
  const start = parseDate(startDate);
  const end = getProbationEndDate(startDate, periodMonths);
  return Math.max(0, differenceInDays(end, start));
}

export function getProbationDaysSpent(startDate: string): number {
  const start = parseDate(startDate);
  const today = parseDate(getTodayPkt());
  return Math.max(0, differenceInDays(today, start));
}

export function isCurrentlyOnProbation(employee: ProbationFields): boolean {
  if (employee.probationCompleted || !employee.probationEnabled || !employee.probationStartDate) {
    return false;
  }

  const today = parseDate(getTodayPkt());
  const end = getProbationEndDate(employee.probationStartDate, employee.probationPeriodMonths);
  return !isAfter(today, end);
}

export function isProbationCompleted(employee: ProbationFields): boolean {
  if (employee.probationCompleted) {
    return true;
  }

  if (!employee.probationEnabled || !employee.probationStartDate) {
    return false;
  }

  return !isCurrentlyOnProbation(employee);
}

export function getProbationStatusLabel(employee: ProbationFields): string {
  if (isProbationCompleted(employee)) {
    return "Probation completed";
  }
  if (isCurrentlyOnProbation(employee) && employee.probationStartDate) {
    const spent = getProbationDaysSpent(employee.probationStartDate);
    const total = getProbationTotalDays(
      employee.probationStartDate,
      employee.probationPeriodMonths,
    );
    return `On probation (${spent}/${total} days)`;
  }
  return "Not on probation";
}

export function defaultProbationValues(): {
  probationEnabled: boolean;
  probationCompleted: boolean;
  probationStartDate: string;
  probationPeriodMonths: number;
} {
  return {
    probationEnabled: true,
    probationCompleted: false,
    probationStartDate: getTodayPkt(),
    probationPeriodMonths: DEFAULT_PROBATION_PERIOD_MONTHS,
  };
}
