import { getDeviceSyncProvider } from "@/lib/device-sync/provider";
import { pushEmployeeById as pushEmployeeToWdms } from "@/lib/wdms/employee-sync";
import { pushEmployeeById as pushEmployeeToZktime } from "@/lib/zktime/employee-sync";

export async function pushEmployeeToDevice(employeeId: string): Promise<void> {
  const provider = getDeviceSyncProvider();
  if (provider === "zktime") {
    await pushEmployeeToZktime(employeeId);
    return;
  }
  if (provider === "wdms") {
    await pushEmployeeToWdms(employeeId);
  }
}
