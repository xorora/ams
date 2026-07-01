export type SalarySlipListQuery = {
  yearMonth?: string;
  employeeId?: string;
};

export type CompensationListQuery = {
  search?: string;
};

export function salarySlipListQuery(filters: SalarySlipListQuery): string {
  const params = new URLSearchParams();
  if (filters.yearMonth) {
    params.set("yearMonth", filters.yearMonth);
  }
  if (filters.employeeId) {
    params.set("employeeId", filters.employeeId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function compensationListQuery(filters: CompensationListQuery): string {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set("search", filters.search);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
