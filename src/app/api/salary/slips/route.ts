import { NextResponse } from "next/server";
import { listEmployeeSalarySlips } from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipListItem } from "@/lib/accounting/serialize";
import { requireApiEmployeeSession } from "@/lib/auth/require-session";

export async function GET() {
  const authResult = await requireApiEmployeeSession();
  if (authResult.response) {
    return authResult.response;
  }

  const employeeId = authResult.session.user.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "Forbidden", code: "EMPLOYEE_NOT_LINKED" }, { status: 403 });
  }

  const result = await listEmployeeSalarySlips(employeeId);
  return NextResponse.json({
    salarySlips: result.data.map((item) => serializeSalarySlipListItem(item)),
  });
}
