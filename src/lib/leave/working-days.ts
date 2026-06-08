import { addDays, differenceInDays, getDay, parse, startOfDay } from "date-fns";

const DATE_FORMAT = "yyyy-MM-dd";

function parseDate(value: string): Date {
  return startOfDay(parse(value, DATE_FORMAT, new Date()));
}

function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6;
}

/** Whether a YYYY-MM-DD date falls on Saturday or Sunday. */
export function isWeekendDate(dateString: string): boolean {
  return isWeekend(parseDate(dateString));
}

/** Count days in an inclusive date range. */
export function countCalendarDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.max(0, differenceInDays(end, start) + 1);
}

/** Count Mon–Fri days in an inclusive date range. */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let count = 0;

  for (let current = start; current <= end; current = addDays(current, 1)) {
    if (!isWeekend(current)) {
      count += 1;
    }
  }

  return count;
}

/** List each calendar date (YYYY-MM-DD) in an inclusive range. */
export function eachDateInRange(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const dates: string[] = [];

  for (let current = start; current <= end; current = addDays(current, 1)) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}
