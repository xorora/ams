import { getExpectedCheckOutAt } from "./rules";

export type OvertimeDayFields = {
  shiftDate: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  overtimeStartedAt?: Date | null;
  overtimeEndedAt?: Date | null;
  overtimeSeconds?: number | null;
};

export type OvertimeSnapshot = {
  isActive: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  elapsedSeconds: number;
};

export function getDefaultOvertimeStart(shiftDate: string): Date {
  return getExpectedCheckOutAt(shiftDate);
}

export function isInOvertimePeriod(day: OvertimeDayFields, now: Date = new Date()): boolean {
  if (!day.checkInAt) {
    return false;
  }

  const threshold = getDefaultOvertimeStart(day.shiftDate);
  if (day.checkOutAt) {
    return day.checkOutAt.getTime() > threshold.getTime();
  }

  return now.getTime() > threshold.getTime();
}

export function computeOvertimeSnapshot(
  day: OvertimeDayFields,
  now: Date = new Date(),
): OvertimeSnapshot {
  const empty: OvertimeSnapshot = {
    isActive: false,
    startedAt: null,
    endedAt: null,
    elapsedSeconds: 0,
  };

  if (!day.checkInAt) {
    return empty;
  }

  const defaultStart = getDefaultOvertimeStart(day.shiftDate);
  const hasActiveOvertime = !day.checkOutAt && now.getTime() > defaultStart.getTime();
  const hasCompletedOvertime =
    day.checkOutAt != null && day.checkOutAt.getTime() > defaultStart.getTime();

  if (!hasActiveOvertime && !hasCompletedOvertime && day.overtimeStartedAt == null) {
    return empty;
  }

  const startedAt = day.overtimeStartedAt ?? defaultStart;
  const endedAt = day.checkOutAt
    ? (day.overtimeEndedAt ?? day.checkOutAt)
    : (day.overtimeEndedAt ?? null);

  if (day.overtimeSeconds != null) {
    return {
      isActive: hasActiveOvertime,
      startedAt,
      endedAt,
      elapsedSeconds: day.overtimeSeconds,
    };
  }

  let elapsedSeconds = 0;
  if (hasActiveOvertime) {
    elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  } else if (endedAt) {
    elapsedSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  }

  return {
    isActive: hasActiveOvertime,
    startedAt,
    endedAt,
    elapsedSeconds,
  };
}

export type OvertimePersistFields = {
  overtimeStartedAt: Date;
  overtimeEndedAt: Date;
  overtimeSeconds: number;
};

export function overtimeFieldsOnCheckout(
  shiftDate: string,
  checkOutAt: Date,
  existingStartedAt: Date | null,
): OvertimePersistFields | null {
  const defaultStart = getDefaultOvertimeStart(shiftDate);
  if (checkOutAt.getTime() <= defaultStart.getTime()) {
    return null;
  }

  const startedAt = existingStartedAt ?? defaultStart;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((checkOutAt.getTime() - startedAt.getTime()) / 1000),
  );

  return {
    overtimeStartedAt: startedAt,
    overtimeEndedAt: checkOutAt,
    overtimeSeconds: elapsedSeconds,
  };
}

export function overtimeFieldsFromTimes(
  shiftDate: string,
  checkInAt: Date | null,
  checkOutAt: Date | null,
  existing: Pick<OvertimeDayFields, "overtimeStartedAt" | "overtimeEndedAt" | "overtimeSeconds">,
): {
  overtimeStartedAt: Date | null;
  overtimeEndedAt: Date | null;
  overtimeSeconds: number | null;
} {
  if (!checkInAt || !checkOutAt) {
    return {
      overtimeStartedAt: null,
      overtimeEndedAt: null,
      overtimeSeconds: null,
    };
  }

  const computed = overtimeFieldsOnCheckout(
    shiftDate,
    checkOutAt,
    existing.overtimeStartedAt ?? null,
  );
  if (!computed) {
    return {
      overtimeStartedAt: null,
      overtimeEndedAt: null,
      overtimeSeconds: null,
    };
  }

  return computed;
}
