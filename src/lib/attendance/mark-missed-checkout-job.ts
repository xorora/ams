import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, breakSessions, companies, employees } from "@/db/schema";
import { getCompanyShiftConfig, isPastMissedCheckOutDeadlineForCompany } from "./company-shift";
import { shouldAutoMarkMissedCheckout } from "./mark-absent-eligibility";
import { type BreakSessionInput, computeTotalBreakSeconds, getActiveBreak } from "./rules";

export type MarkMissedCheckoutJobResult = {
  shiftDate: string;
  marked: number;
  skipped: number;
};

const MISSED_CHECKOUT_NOTE = "Marked present: missed check-out deadline.";

function appendNote(existing: string | null, note: string): string {
  if (!existing?.trim()) {
    return note;
  }
  if (existing.includes(note)) {
    return existing;
  }
  return `${existing.trim()}\n${note}`;
}

async function closeActiveBreak(
  attendanceDayId: string,
  breakInputs: BreakSessionInput[],
  at: Date,
): Promise<BreakSessionInput[]> {
  const active = getActiveBreak(breakInputs);
  if (!active) {
    return breakInputs;
  }

  const [activeRow] = await db
    .select()
    .from(breakSessions)
    .where(and(eq(breakSessions.attendanceDayId, attendanceDayId), isNull(breakSessions.endedAt)))
    .limit(1);

  if (!activeRow) {
    return breakInputs;
  }

  const durationSeconds = Math.max(
    0,
    Math.floor((at.getTime() - activeRow.startedAt.getTime()) / 1000),
  );

  await db
    .update(breakSessions)
    .set({
      endedAt: at,
      durationSeconds,
    })
    .where(eq(breakSessions.id, activeRow.id));

  return breakInputs.map((session) =>
    session.startedAt.getTime() === activeRow.startedAt.getTime() && session.endedAt == null
      ? { startedAt: session.startedAt, endedAt: at, durationSeconds }
      : session,
  );
}

export async function runMarkMissedCheckoutJob(
  runAt: Date = new Date(),
): Promise<MarkMissedCheckoutJobResult> {
  const openDays = await db
    .select({
      id: attendanceDays.id,
      employeeId: attendanceDays.employeeId,
      shiftDate: attendanceDays.shiftDate,
      checkInAt: attendanceDays.checkInAt,
      checkOutAt: attendanceDays.checkOutAt,
      status: attendanceDays.status,
      source: attendanceDays.source,
      isMissedCheckout: attendanceDays.isMissedCheckout,
      notes: attendanceDays.notes,
      companySlug: companies.slug,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(and(isNotNull(attendanceDays.checkInAt), isNull(attendanceDays.checkOutAt)));

  let marked = 0;
  let skipped = 0;
  const shiftDates = new Set<string>();

  for (const day of openDays) {
    shiftDates.add(day.shiftDate);
    const config = getCompanyShiftConfig(day.companySlug);
    if (!isPastMissedCheckOutDeadlineForCompany(runAt, day.shiftDate, config)) {
      skipped += 1;
      continue;
    }

    if (!shouldAutoMarkMissedCheckout(day)) {
      skipped += 1;
      continue;
    }

    const sessions = await db
      .select()
      .from(breakSessions)
      .where(eq(breakSessions.attendanceDayId, day.id));

    const breakInputs: BreakSessionInput[] = sessions.map((session) => ({
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    }));

    const updatedSessions = await closeActiveBreak(day.id, breakInputs, runAt);
    const totalBreakSeconds = computeTotalBreakSeconds(updatedSessions, runAt);

    await db
      .update(attendanceDays)
      .set({
        status: "present",
        source: "system",
        isMissedCheckout: true,
        totalBreakSeconds,
        notes: appendNote(day.notes, MISSED_CHECKOUT_NOTE),
        updatedAt: runAt,
      })
      .where(eq(attendanceDays.id, day.id));

    marked += 1;
  }

  return {
    shiftDate: [...shiftDates].sort().join(", ") || "none",
    marked,
    skipped,
  };
}
