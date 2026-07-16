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
  page?: number;
  limit?: number;
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
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.limit && filters.limit !== 50) {
    params.set("limit", String(filters.limit));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Swap from/to when both are set and from is after to. */
export function normalizeAttendanceDateRange(
  from: string,
  to: string,
): { from: string; to: string } {
  if (from && to && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

export function reportDateQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
