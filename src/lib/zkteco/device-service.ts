import { createHash } from "node:crypto";
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { syncState, zktecoDeviceCommands, zktecoDevices } from "@/db/schema";
import { formatWireCommand } from "@/lib/zkteco/adms/commands";
import { extractWireCommandId } from "@/lib/zkteco/adms/parser";
import {
  getDeviceOnlineThresholdMs,
  getDeviceStaleThresholdMs,
  getZktecoTimezoneOffsetHours,
} from "@/lib/zkteco/config";

const COMMAND_ID_KEY = "zkteco_next_command_id";

export type DeviceMetadata = {
  ipAddress?: string | null;
  firmwareVersion?: string | null;
  pushVersion?: string | null;
};

export type DeviceConnectionStatus = "online" | "stale" | "offline";

export type EnsureDeviceOptions = {
  /** When false, auth succeeds but last_seen_at is not updated (admin/script probes). */
  recordHeartbeat?: boolean;
};

export type ZktecoDevice = typeof zktecoDevices.$inferSelect;

export function hashAdmsPunchId(serialNumber: string, pin: string, datetime: string): number {
  const digest = createHash("sha256").update(`${serialNumber}:${pin}:${datetime}`).digest();
  // machine_punches.source_punch_id is a signed int32 — use readInt32BE, not readUInt32BE.
  return digest.readInt32BE(0) || 1;
}

export async function allocateCommandId(): Promise<number> {
  const rows = await db
    .insert(syncState)
    .values({ key: COMMAND_ID_KEY, value: "1" })
    .onConflictDoUpdate({
      target: syncState.key,
      set: {
        value: sql`(COALESCE(${syncState.value}::bigint, 0) + 1)::text`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ value: syncState.value });

  return Number.parseInt(rows[0]?.value ?? "1", 10);
}

export async function ensureDevice(
  serialNumber: string,
  metadata: DeviceMetadata = {},
  options: EnsureDeviceOptions = {},
): Promise<ZktecoDevice> {
  const recordHeartbeat = options.recordHeartbeat ?? true;
  const now = new Date();
  const existing = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.serialNumber, serialNumber),
  });

  if (existing && !recordHeartbeat) {
    return existing;
  }

  if (existing) {
    const [updated] = await db
      .update(zktecoDevices)
      .set({
        lastSeenAt: now,
        updatedAt: now,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.firmwareVersion ? { firmwareVersion: metadata.firmwareVersion } : {}),
        ...(metadata.pushVersion ? { pushVersion: metadata.pushVersion } : {}),
      })
      .where(eq(zktecoDevices.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(zktecoDevices)
    .values({
      serialNumber,
      alias: serialNumber,
      lastSeenAt: now,
      ipAddress: metadata.ipAddress ?? null,
      firmwareVersion: metadata.firmwareVersion ?? null,
      pushVersion: metadata.pushVersion ?? null,
    })
    .returning();

  void import("@/lib/zkteco/employee-sync")
    .then(({ scheduleDeviceBootstrap }) => scheduleDeviceBootstrap(created.id))
    .catch((error) => {
      console.error("[zkteco/device-service] device bootstrap sync failed", error);
    });

  return created;
}

export async function touchDevice(serialNumber: string): Promise<ZktecoDevice | null> {
  const now = new Date();
  const rows = await db
    .update(zktecoDevices)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(eq(zktecoDevices.serialNumber, serialNumber))
    .returning();

  return rows[0] ?? null;
}

export function buildHandshakeResponse(serialNumber: string): string {
  const timezone = getZktecoTimezoneOffsetHours();
  return [
    `GET OPTION FROM: ${serialNumber}`,
    "ATTLOGStamp=0",
    "OPERLOGStamp=0",
    "BIODATAStamp=0",
    "ATTPHOTOStamp=0",
    "ErrorDelay=10",
    "Delay=5",
    "TransTimes=00:00;14:00",
    "TransInterval=1",
    "TransFlag=111111111111",
    `TimeZone=${timezone}`,
    "Realtime=1",
    "Encrypt=0",
    "ServerVer=3.0.1",
  ].join("\n");
}

export async function enqueueDeviceCommand(
  deviceId: string,
  command: string,
): Promise<typeof zktecoDeviceCommands.$inferSelect> {
  const commandId = await allocateCommandId();
  const commandText = formatWireCommand(commandId, command);

  const [row] = await db
    .insert(zktecoDeviceCommands)
    .values({
      deviceId,
      commandText,
      status: "pending",
    })
    .returning();

  return row;
}

export async function countPendingCommands(deviceId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(zktecoDeviceCommands)
    .where(
      and(eq(zktecoDeviceCommands.deviceId, deviceId), eq(zktecoDeviceCommands.status, "pending")),
    );
  return rows[0]?.count ?? 0;
}

/** Re-queue commands marked sent but never acknowledged by the device (e.g. stolen by verify probes). */
export async function requeueStaleSentCommands(
  deviceId: string,
  staleAfterMs = 120_000,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const rows = await db
    .update(zktecoDeviceCommands)
    .set({ status: "pending", sentAt: null })
    .where(
      and(
        eq(zktecoDeviceCommands.deviceId, deviceId),
        eq(zktecoDeviceCommands.status, "sent"),
        isNull(zktecoDeviceCommands.completedAt),
        lt(zktecoDeviceCommands.sentAt, cutoff),
      ),
    )
    .returning({ id: zktecoDeviceCommands.id });

  return rows.length;
}

export async function getNextPendingCommand(
  deviceId: string,
): Promise<typeof zktecoDeviceCommands.$inferSelect | null> {
  const pending = await db.query.zktecoDeviceCommands.findFirst({
    where: and(
      eq(zktecoDeviceCommands.deviceId, deviceId),
      eq(zktecoDeviceCommands.status, "pending"),
    ),
    orderBy: asc(zktecoDeviceCommands.createdAt),
  });

  if (!pending) {
    return null;
  }

  const now = new Date();
  const [sent] = await db
    .update(zktecoDeviceCommands)
    .set({ status: "sent", sentAt: now })
    .where(eq(zktecoDeviceCommands.id, pending.id))
    .returning();

  return sent;
}

export async function completeCommandByWireId(
  deviceId: string,
  wireCommandId: string,
  returnCode: number,
  resultText?: string,
): Promise<boolean> {
  const commands = await db.query.zktecoDeviceCommands.findMany({
    where: and(
      eq(zktecoDeviceCommands.deviceId, deviceId),
      eq(zktecoDeviceCommands.status, "sent"),
    ),
    orderBy: asc(zktecoDeviceCommands.sentAt),
  });

  const match = commands.find((cmd) => extractWireCommandId(cmd.commandText) === wireCommandId);
  if (!match) {
    return false;
  }

  const now = new Date();
  await db
    .update(zktecoDeviceCommands)
    .set({
      status: returnCode === 0 ? "completed" : "failed",
      completedAt: now,
      resultText: resultText ?? `Return=${returnCode}`,
    })
    .where(eq(zktecoDeviceCommands.id, match.id));

  return true;
}

export function getSecondsSinceLastSeen(lastSeenAt: Date | null): number | null {
  if (!lastSeenAt) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - lastSeenAt.getTime()) / 1000));
}

export function getDeviceConnectionStatus(lastSeenAt: Date | null): DeviceConnectionStatus {
  const seconds = getSecondsSinceLastSeen(lastSeenAt);
  if (seconds === null) {
    return "offline";
  }

  const onlineThresholdSec = getDeviceOnlineThresholdMs() / 1000;
  const staleThresholdSec = getDeviceStaleThresholdMs() / 1000;

  if (seconds <= onlineThresholdSec) {
    return "online";
  }
  if (seconds <= staleThresholdSec) {
    return "stale";
  }
  return "offline";
}

export function isDeviceOnline(lastSeenAt: Date | null): boolean {
  return getDeviceConnectionStatus(lastSeenAt) === "online";
}

/** True when the device may still pick up queued ADMS commands (online or recently seen). */
export function isDeviceReachable(lastSeenAt: Date | null): boolean {
  const status = getDeviceConnectionStatus(lastSeenAt);
  return status === "online" || status === "stale";
}

export function formatDeviceLastSeen(lastSeenAt: Date | null): string {
  const seconds = getSecondsSinceLastSeen(lastSeenAt);
  if (seconds === null) {
    return "Never";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86_400)}d ago`;
}
