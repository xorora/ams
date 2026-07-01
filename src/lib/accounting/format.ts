export function formatSalaryPkr(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const monthIndex = Number.parseInt(month ?? "", 10) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return yearMonth;
  }
  const date = new Date(Number.parseInt(year, 10), monthIndex, 1);
  return date.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
