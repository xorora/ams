export type LeaveListQuery = {
  status?: string;
  leaveType?: string;
  employeeId?: string;
};

export function leaveListQuery(filters: LeaveListQuery): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.leaveType) {
    params.set("leaveType", filters.leaveType);
  }
  if (filters.employeeId) {
    params.set("employeeId", filters.employeeId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
