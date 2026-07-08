
/** US federal holidays observed by Xorora employees (YYYY-MM-DD → name). */
const XORORA_FEDERAL_HOLIDAYS_BY_YEAR: Record<string, Record<string, string>> = {
  "2026": {
    "2026-01-01": "New Year's Day",
    "2026-01-19": "Birthday of Martin Luther King, Jr.",
    "2026-02-16": "Washington's Birthday",
    "2026-05-25": "Memorial Day",
    "2026-06-19": "Juneteenth National Independence Day",
    "2026-07-03": "Independence Day",
    "2026-09-07": "Labor Day",
    "2026-10-12": "Columbus Day",
    "2026-11-11": "Veterans Day",
    "2026-11-26": "Thanksgiving Day",
    "2026-12-25": "Christmas Day",
  },
};

const XORORA_HOLIDAY_DATES = new Map<string, string>(
  Object.values(XORORA_FEDERAL_HOLIDAYS_BY_YEAR).flatMap((year) =>
    Object.entries(year),
  ),
);

export function isXororaFederalHoliday(shiftDate: string): boolean {
  return XORORA_HOLIDAY_DATES.has(shiftDate);
}

export function getXororaFederalHolidayName(shiftDate: string): string | null {
  return XORORA_HOLIDAY_DATES.get(shiftDate) ?? null;
}

export function isCompanyFederalHoliday(companySlug: string, shiftDate: string): boolean {
  if (companySlug !== "xorora") {
    return false;
  }
  return isXororaFederalHoliday(shiftDate);
}

export function getCompanyFederalHolidayName(
  companySlug: string,
  shiftDate: string,
): string | null {
  if (companySlug !== "xorora") {
    return null;
  }
  return getXororaFederalHolidayName(shiftDate);
}

export function listXororaFederalHolidays(year: string): Array<{ date: string; name: string }> {
  const yearHolidays = XORORA_FEDERAL_HOLIDAYS_BY_YEAR[year];
  if (!yearHolidays) {
    return [];
  }

  return Object.entries(yearHolidays)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, name]) => ({ date, name }));
}

export function companyObservesFederalHolidays(companySlug: string): boolean {
  return companySlug === "xorora";
}
