/**
 * Queue ADMS commands to push companies and/or employees to a ZKTeco device.
 *
 * Usage (loads .env.local via bun):
 *   bun --env-file=.env.local scripts/zkteco-push-device.ts
 *   bun --env-file=.env.local scripts/zkteco-push-device.ts PAS4261300498 sync
 *   bun --env-file=.env.local scripts/zkteco-push-device.ts PAS4261300498 companies
 *   bun --env-file=.env.local scripts/zkteco-push-device.ts PAS4261300498 employees
 *
 * Requires ZKTECO_SYNC_ALL_COMPANIES=true to push every active company/employee.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { zktecoDevices } from "@/db/schema";
import { triggerDeviceCompanyPush } from "@/lib/zkteco/company-sync";
import { shouldSyncAllCompanies } from "@/lib/zkteco/config";
import { triggerDeviceEmployeePush, triggerReconcileDeviceSync } from "@/lib/zkteco/employee-sync";

type Stage = "companies" | "employees" | "all" | "sync";

const serialNumber = process.argv[2]?.trim() || "PAS4261300498";
const stage = (process.argv[3]?.trim() || "sync") as Stage;

if (!["companies", "employees", "all", "sync"].includes(stage)) {
  console.error("Stage must be companies, employees, all, or sync");
  process.exit(1);
}

const device = await db.query.zktecoDevices.findFirst({
  where: eq(zktecoDevices.serialNumber, serialNumber),
});

if (!device) {
  console.error(`Device not found: ${serialNumber}`);
  process.exit(1);
}

console.log(`Device: ${device.serialNumber} (${device.id})`);
console.log(`Sync all companies: ${shouldSyncAllCompanies()}`);
if (!shouldSyncAllCompanies()) {
  console.log(
    "Hint: set ZKTECO_SYNC_ALL_COMPANIES=true in .env.local and Vercel to include every company.",
  );
}

if (stage === "sync") {
  const result = await triggerReconcileDeviceSync(device.id);
  const total =
    result.companyPush.queued +
    result.push.queued +
    (result.companyPull.queued ? 1 : 0) +
    (result.pull.queued ? 1 : 0);
  console.log(
    `Reconcile queued: ${total} commands (${result.companyPush.queued} depts, ${result.push.queued} employees, pull=${result.companyPull.queued || result.pull.queued})`,
  );
} else {
  if (stage === "companies" || stage === "all") {
    const result = await triggerDeviceCompanyPush(device.id);
    console.log(`Companies queued: ${result.queued}`);
  }

  if (stage === "employees" || stage === "all") {
    const result = await triggerDeviceEmployeePush(device.id);
    console.log(`Employees queued: ${result.queued}`);
  }
}

console.log("Done. Device picks up one command per heartbeat (~5 s).");
