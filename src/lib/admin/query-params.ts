export function employeesListQuery(search: string, includeInactive: boolean): string {
  const params = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) {
    params.set("search", trimmed);
  }
  if (includeInactive) {
    params.set("includeInactive", "true");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type AttendanceListQuery = {
  from?: string;
  to?: string;
  employeeId?: string;
  status?: string;
};

export function attendanceListQuery(filters: AttendanceListQuery): string {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.employeeId) {
    params.set("employeeId", filters.employeeId);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function reportDateQuery(from: string, to: string): string {
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}
