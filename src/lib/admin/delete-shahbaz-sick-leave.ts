import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/schema";
import { deleteLeaveRequest, getLeaveBalances } from "@/lib/leave/leave-service";

/**
 * One-shot ops: remove Shahbaz Afzal (001) approved sick leave on 2026-07-07
 * and restore the day to his sick leave pool.
 */
export async function deleteShahbazSickLeave20260707() {
  const employeeRows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
    })
    .from(employees)
    .where(sql`lower(${employees.employeeCode}) = ${"001"}`);

  const matches: Array<{
    leaveId: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    daysCount: number;
    attendanceCleared: number;
    sickRemainingAfter: number | null;
  }> = [];

  for (const emp of employeeRows) {
    const rows = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, emp.id),
          eq(leaveRequests.leaveType, "sick"),
          eq(leaveRequests.startDate, "2026-07-07"),
          eq(leaveRequests.endDate, "2026-07-07"),
          eq(leaveRequests.status, "approved"),
        ),
      );

    for (const row of rows) {
      const result = await deleteLeaveRequest(row.id);
      if (!result.ok) {
        throw new Error(result.message);
      }

      const balances = await getLeaveBalances(emp.id, 2026);
      const sick = balances.ok
        ? (balances.data.find((b) => b.leaveType === "sick")?.remaining ?? null)
        : null;

      matches.push({
        leaveId: result.data.deleted.id,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        daysCount: result.data.deleted.daysCount,
        attendanceCleared: result.data.attendanceCleared,
        sickRemainingAfter: sick,
      });
    }
  }

  return { deleted: matches.length, matches };
}
