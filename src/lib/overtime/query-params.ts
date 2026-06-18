export type OvertimeListQuery = {
  status?: string;
  employeeId?: string;
};

export function overtimeListQuery(filters: OvertimeListQuery): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.employeeId) {
    params.set("employeeId", filters.employeeId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
