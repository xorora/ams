import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, breakSessions, companies, employees } from "@/db/schema";
import {
  type CompanyShiftConfig,
  getMaxBreakSeconds,
  getScheduledBreakBounds,
  getShiftConfigForEmployee,
  isWithinScheduledBreakWindow,
} from "./company-shift";
import {
  type BreakSessionInput,
  canStartBreak,
  computeTotalBreakSeconds,
  getActiveBreak,
} from "./rules";

export type ScheduledBreakAutoResult = {
  scanned: number;
  started: number;
  ended: number;
};

type OpenDayRow = {
  attendanceDayId: string;
  employeeId: string;
  shiftDate: string;
  companySlug: string;
  fullName: string | null;
  shiftPreset: string | null;
};

async function loadBreakInputs(attendanceDayId: string): Promise<BreakSessionInput[]> {
  const sessions = await db
    .select({
      startedAt: breakSessions.startedAt,
      endedAt: breakSessions.endedAt,
      durationSeconds: breakSessions.durationSeconds,
    })
    .from(breakSessions)
    .where(eq(breakSessions.attendanceDayId, attendanceDayId));

  return sessions.map((session) => ({
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
  }));
}

async function endActiveBreakSession(
  attendanceDayId: string,
  sessions: BreakSessionInput[],
  endedAt: Date,
): Promise<boolean> {
  const active = getActiveBreak(sessions);
  if (!active) {
    return false;
  }

  const [activeRow] = await db
    .select({ id: breakSessions.id, startedAt: breakSessions.startedAt })
    .from(breakSessions)
    .where(and(eq(breakSessions.attendanceDayId, attendanceDayId), isNull(breakSessions.endedAt)))
    .limit(1);

  if (!activeRow) {
    return false;
  }

  const durationSeconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - activeRow.startedAt.getTime()) / 1000),
  );

  await db
    .update(breakSessions)
    .set({
      endedAt,
      durationSeconds,
    })
    .where(eq(breakSessions.id, activeRow.id));

  const updatedSessions: BreakSessionInput[] = sessions.map((session) =>
    session.startedAt.getTime() === activeRow.startedAt.getTime() && session.endedAt == null
      ? { startedAt: session.startedAt, endedAt, durationSeconds }
      : session,
  );

  await db
    .update(attendanceDays)
    .set({
      totalBreakSeconds: computeTotalBreakSeconds(updatedSessions, endedAt),
      updatedAt: endedAt,
    })
    .where(eq(attendanceDays.id, attendanceDayId));

  return true;
}

async function startBreakSession(attendanceDayId: string, startedAt: Date): Promise<void> {
  await db.insert(breakSessions).values({
    attendanceDayId,
    startedAt,
  });
}

/**
 * Auto-start when the scheduled window is open and no break is running.
 * Auto-end when the window has closed (or the duration cap is exhausted).
 */
export async function reconcileScheduledBreakForOpenDay(
  row: OpenDayRow,
  now: Date = new Date(),
  shiftConfig?: CompanyShiftConfig,
): Promise<{ started: boolean; ended: boolean }> {
  const config =
    shiftConfig ??
    getShiftConfigForEmployee(row.companySlug, row.shiftPreset, row.fullName, row.shiftDate);

  if (!config.scheduledBreak) {
    return { started: false, ended: false };
  }

  const bounds = getScheduledBreakBounds(row.shiftDate, config);
  if (!bounds) {
    return { started: false, ended: false };
  }

  const sessions = await loadBreakInputs(row.attendanceDayId);
  const active = getActiveBreak(sessions);
  let ended = false;
  let started = false;

  if (active) {
    const maxBreakSeconds = getMaxBreakSeconds(row.shiftDate, config);
    const activeSeconds = Math.max(
      0,
      Math.floor((now.getTime() - active.startedAt.getTime()) / 1000),
    );
    const pastWindow = now.getTime() >= bounds.end.getTime();
    const overCap = activeSeconds >= maxBreakSeconds;

    if (pastWindow || overCap) {
      const endedAt = pastWindow
        ? new Date(Math.min(now.getTime(), bounds.end.getTime()))
        : new Date(active.startedAt.getTime() + maxBreakSeconds * 1000);
      ended = await endActiveBreakSession(row.attendanceDayId, sessions, endedAt);
    }

    return { started: false, ended };
  }

  // Only auto-start once the window has opened; never before start.
  if (now.getTime() < bounds.start.getTime()) {
    return { started: false, ended: false };
  }

  if (!isWithinScheduledBreakWindow(now, row.shiftDate, config)) {
    return { started: false, ended: false };
  }

  // One automatic start per shift — if they already took a break, leave restarts manual.
  if (sessions.length > 0) {
    return { started: false, ended: false };
  }

  const rule = canStartBreak(sessions, now, {
    shiftDate: row.shiftDate,
    shiftConfig: config,
  });
  if (!rule.ok) {
    return { started: false, ended: false };
  }

  await startBreakSession(row.attendanceDayId, now);
  started = true;
  return { started, ended: false };
}

export async function reconcileScheduledBreakForEmployee(
  employeeId: string,
  now: Date = new Date(),
): Promise<{ started: boolean; ended: boolean }> {
  const openDays = await db
    .select({
      attendanceDayId: attendanceDays.id,
      employeeId: attendanceDays.employeeId,
      shiftDate: attendanceDays.shiftDate,
      companySlug: companies.slug,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        isNull(attendanceDays.checkOutAt),
        or(isNotNull(attendanceDays.checkInAt), eq(attendanceDays.status, "present")),
      ),
    );

  if (openDays.length === 0) {
    return { started: false, ended: false };
  }

  openDays.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
  return reconcileScheduledBreakForOpenDay(openDays[0], now);
}

/** Cron: auto-start/end scheduled breaks for all open shifts. */
export async function runScheduledBreakAutoJob(
  runAt: Date = new Date(),
): Promise<ScheduledBreakAutoResult> {
  const openDays = await db
    .select({
      attendanceDayId: attendanceDays.id,
      employeeId: attendanceDays.employeeId,
      shiftDate: attendanceDays.shiftDate,
      companySlug: companies.slug,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(
      and(
        eq(employees.isActive, true),
        isNull(attendanceDays.checkOutAt),
        or(isNotNull(attendanceDays.checkInAt), eq(attendanceDays.status, "present")),
      ),
    );

  let started = 0;
  let ended = 0;

  for (const row of openDays) {
    const config = getShiftConfigForEmployee(
      row.companySlug,
      row.shiftPreset,
      row.fullName,
      row.shiftDate,
    );
    if (!config.scheduledBreak) {
      continue;
    }

    const result = await reconcileScheduledBreakForOpenDay(row, runAt, config);
    if (result.started) {
      started += 1;
    }
    if (result.ended) {
      ended += 1;
    }
  }

  return {
    scanned: openDays.length,
    started,
    ended,
  };
}
