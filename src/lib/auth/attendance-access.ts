import type { Session } from "next-auth";

/** User can self-serve check-in when linked to an active employee record (any role). */
export function hasLinkedEmployee(session: Session): boolean {
  return typeof session.user.employeeId === "string" && session.user.employeeId.length > 0;
}
