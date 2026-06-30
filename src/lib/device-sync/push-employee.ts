import { pushEmployeeById } from "@/lib/zktime/employee-sync";

export async function pushEmployeeToDevice(employeeId: string): Promise<void> {
  await pushEmployeeById(employeeId);
}
