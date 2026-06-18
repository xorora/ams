import type { Session } from "next-auth";
import { getEmployee } from "@/lib/admin/employees-service";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";

export async function canEmployeeAccessLeave(user: Session["user"]): Promise<boolean> {
  if (!hasLinkedEmployee({ user } as Session)) {
    return false;
  }

  const employeeId = user.employeeId;
  if (!employeeId) {
    return false;
  }

  const result = await getEmployee(employeeId);
  return result.ok && result.data.isActive;
}
