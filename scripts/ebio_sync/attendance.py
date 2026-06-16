"""Derive attendance_days rows from linked machine punches."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from ebio_sync.config import Config

LOG = logging.getLogger("ebio_sync")

INSERT_BATCH_SIZE = 100

# --- constants (mirrors src/lib/attendance/constants.ts) ---

EXPECTED_CHECK_IN_HOUR = 18
CHECK_IN_GRACE_MINUTES = 15
CHECK_OUT_GRACE_MINUTES = 15
EXPECTED_CHECK_OUT_HOUR = 3
EXPECTED_CHECK_OUT_MINUTE = 0
SHIFT_DATE_NOON_BOUNDARY_HOUR = 12


@dataclass(frozen=True)
class CompanyShiftConfig:
    expected_check_in_hour: int
    expected_check_in_minute: int
    check_in_grace_minutes: int
    check_out_grace_minutes: int
    expected_check_out_hour: int
    expected_check_out_minute: int
    check_out_next_day: bool
    shift_date_boundary_hour: int


COMPANY_SHIFT_BY_SLUG: dict[str, CompanyShiftConfig] = {
    "xorora": CompanyShiftConfig(
        expected_check_in_hour=EXPECTED_CHECK_IN_HOUR,
        expected_check_in_minute=0,
        check_in_grace_minutes=CHECK_IN_GRACE_MINUTES,
        check_out_grace_minutes=CHECK_OUT_GRACE_MINUTES,
        expected_check_out_hour=EXPECTED_CHECK_OUT_HOUR,
        expected_check_out_minute=EXPECTED_CHECK_OUT_MINUTE,
        check_out_next_day=True,
        shift_date_boundary_hour=SHIFT_DATE_NOON_BOUNDARY_HOUR,
    ),
    "crest-led": CompanyShiftConfig(
        expected_check_in_hour=9,
        expected_check_in_minute=0,
        check_in_grace_minutes=15,
        check_out_grace_minutes=15,
        expected_check_out_hour=17,
        expected_check_out_minute=0,
        check_out_next_day=False,
        shift_date_boundary_hour=0,
    ),
}


def get_company_shift_config(slug: str) -> CompanyShiftConfig:
    return COMPANY_SHIFT_BY_SLUG.get(slug, COMPANY_SHIFT_BY_SLUG["xorora"])


def _shift_date_add_days(shift_date: str, days: int, tz: ZoneInfo) -> str:
    year, month, day = (int(part) for part in shift_date.split("-"))
    anchor = datetime(year, month, day, 12, 0, 0, tzinfo=tz)
    return (anchor + timedelta(days=days)).date().isoformat()


def _zoned_time_on_shift_date(
    shift_date: str,
    hour: int,
    minute: int,
    second: int,
    tz: ZoneInfo,
) -> datetime:
    year, month, day = (int(part) for part in shift_date.split("-"))
    local = datetime(year, month, day, hour, minute, second, tzinfo=tz)
    return local.astimezone(timezone.utc)


def get_shift_date_for_company(
    at: datetime,
    config: CompanyShiftConfig,
    tz: ZoneInfo,
) -> str:
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    local = at.astimezone(tz)
    calendar_date = local.date().isoformat()
    if local.hour >= config.shift_date_boundary_hour:
        return calendar_date
    return _shift_date_add_days(calendar_date, -1, tz)


def get_late_check_in_deadline(
    shift_date: str,
    config: CompanyShiftConfig,
    tz: ZoneInfo,
) -> datetime:
    total_minutes = (
        config.expected_check_in_hour * 60
        + config.expected_check_in_minute
        + config.check_in_grace_minutes
    )
    return _zoned_time_on_shift_date(
        shift_date,
        (total_minutes // 60) % 24,
        total_minutes % 60,
        0,
        tz,
    )


def get_expected_check_out_at(
    shift_date: str,
    config: CompanyShiftConfig,
    tz: ZoneInfo,
) -> datetime:
    checkout_date = (
        _shift_date_add_days(shift_date, 1, tz) if config.check_out_next_day else shift_date
    )
    return _zoned_time_on_shift_date(
        checkout_date,
        config.expected_check_out_hour,
        config.expected_check_out_minute,
        0,
        tz,
    )


def is_late_check_in_for_company(
    check_in_at: datetime,
    shift_date: str,
    config: CompanyShiftConfig,
    tz: ZoneInfo,
) -> bool:
    return check_in_at > get_late_check_in_deadline(shift_date, config, tz)


def is_early_leave_for_company(
    check_out_at: datetime,
    shift_date: str,
    config: CompanyShiftConfig,
    tz: ZoneInfo,
) -> bool:
    return check_out_at < get_expected_check_out_at(shift_date, config, tz)


@dataclass
class PunchGroup:
    employee_id: str
    shift_date: str
    check_in_at: datetime
    check_out_at: datetime | None
    company_slug: str


LINKED_PUNCHES_SQL = """
SELECT mp.employee_id, mp.punch_at, c.slug AS company_slug
FROM machine_punches AS mp
JOIN employees AS e ON e.id = mp.employee_id
JOIN companies AS c ON c.id = e.company_id
WHERE mp.employee_id IS NOT NULL
"""

UPSERT_ATTENDANCE_SQL = """
INSERT INTO attendance_days (
    employee_id, shift_date, status, source,
    check_in_at, check_out_at,
    check_in_lat, check_in_lng, check_out_lat, check_out_lng,
    is_late, is_early_leave,
    overtime_started_at, overtime_ended_at, overtime_seconds,
    total_break_seconds
)
VALUES (
    %(employee_id)s, %(shift_date)s, %(status)s, %(source)s,
    %(check_in_at)s, %(check_out_at)s,
    %(check_in_lat)s, %(check_in_lng)s, %(check_out_lat)s, %(check_out_lng)s,
    %(is_late)s, %(is_early_leave)s,
    %(overtime_started_at)s, %(overtime_ended_at)s, %(overtime_seconds)s,
    %(total_break_seconds)s
)
ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    check_in_at = EXCLUDED.check_in_at,
    check_out_at = EXCLUDED.check_out_at,
    is_late = EXCLUDED.is_late,
    is_early_leave = EXCLUDED.is_early_leave,
    overtime_started_at = EXCLUDED.overtime_started_at,
    overtime_ended_at = EXCLUDED.overtime_ended_at,
    overtime_seconds = EXCLUDED.overtime_seconds,
    updated_at = NOW()
WHERE attendance_days.source = 'system'
RETURNING id
"""


def _fetch_linked_punches(
    pg_conn,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[tuple[str, datetime, str]]:
    clauses = [LINKED_PUNCHES_SQL.strip()]
    params: list[Any] = []

    if since is not None:
        clauses.append("AND mp.punch_at >= %s")
        params.append(since)
    if until is not None:
        clauses.append("AND mp.punch_at <= %s")
        params.append(until)

    sql = "\n".join(clauses)
    with pg_conn.cursor() as cur:
        cur.execute(sql, params)
        return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def _group_punches(
    rows: list[tuple[str, datetime, str]],
    tz: ZoneInfo,
) -> list[PunchGroup]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}

    for employee_id, punch_at, company_slug in rows:
        config = get_company_shift_config(company_slug)
        shift_date = get_shift_date_for_company(punch_at, config, tz)
        key = (employee_id, shift_date)
        existing = by_key.get(key)
        if existing is not None:
            existing["punches"].append(punch_at)
        else:
            by_key[key] = {
                "employee_id": employee_id,
                "shift_date": shift_date,
                "company_slug": company_slug,
                "punches": [punch_at],
            }

    groups: list[PunchGroup] = []
    for entry in by_key.values():
        punches: list[datetime] = sorted(entry["punches"], key=lambda dt: dt.timestamp())
        check_in_at = punches[0]
        check_out_at = punches[-1] if len(punches) > 1 else None
        groups.append(
            PunchGroup(
                employee_id=entry["employee_id"],
                shift_date=entry["shift_date"],
                check_in_at=check_in_at,
                check_out_at=check_out_at,
                company_slug=entry["company_slug"],
            )
        )
    return groups


def _build_attendance_row(group: PunchGroup, tz: ZoneInfo) -> dict[str, Any]:
    config = get_company_shift_config(group.company_slug)
    is_late = is_late_check_in_for_company(group.check_in_at, group.shift_date, config, tz)
    is_early_leave = (
        is_early_leave_for_company(group.check_out_at, group.shift_date, config, tz)
        if group.check_out_at is not None
        else False
    )

    overtime_started_at: datetime | None = None
    overtime_ended_at: datetime | None = None
    overtime_seconds: int | None = None

    if group.check_out_at is not None:
        expected_checkout = get_expected_check_out_at(group.shift_date, config, tz)
        if group.check_out_at > expected_checkout:
            overtime_started_at = expected_checkout
            overtime_ended_at = group.check_out_at
            overtime_seconds = max(
                0,
                int((group.check_out_at - expected_checkout).total_seconds()),
            )

    return {
        "employee_id": group.employee_id,
        "shift_date": group.shift_date,
        "status": "present",
        "source": "system",
        "check_in_at": group.check_in_at,
        "check_out_at": group.check_out_at,
        "check_in_lat": None,
        "check_in_lng": None,
        "check_out_lat": None,
        "check_out_lng": None,
        "is_late": is_late,
        "is_early_leave": is_early_leave,
        "overtime_started_at": overtime_started_at,
        "overtime_ended_at": overtime_ended_at,
        "overtime_seconds": overtime_seconds,
        "total_break_seconds": 0,
    }


def _upsert_attendance_rows(pg_conn, rows: list[dict[str, Any]]) -> int:
    """Insert or update machine-derived attendance (system source only)."""
    affected = 0
    for start in range(0, len(rows), INSERT_BATCH_SIZE):
        batch = rows[start : start + INSERT_BATCH_SIZE]
        with pg_conn.cursor() as cur:
            for row in batch:
                cur.execute(UPSERT_ATTENDANCE_SQL, row)
                if cur.fetchone() is not None:
                    affected += 1
        pg_conn.commit()
    return affected


def process_attendance(
    cfg: Config,
    pg_conn,
    *,
    dry_run: bool = False,
    since: datetime | None = None,
    until: datetime | None = None,
) -> int:
    """Group linked punches by shift date and upsert attendance_days rows.

    Uses per-employee company shift rules:
    - crest-led: 9:00–17:00 day shift (calendar-date boundary at midnight)
    - xorora: 18:00–03:00 night shift (shift date boundary at noon)

    Rows with source ``system`` are updated when new punches arrive (e.g. same-day
    check-out). Manual and mobile (auto) attendance is never overwritten.
    """
    tz = cfg.tz
    punch_rows = _fetch_linked_punches(pg_conn, since=since, until=until)
    if not punch_rows:
        LOG.debug("No linked punches to process for attendance.")
        return 0

    groups = _group_punches(punch_rows, tz)
    attendance_rows = [_build_attendance_row(group, tz) for group in groups]

    if dry_run:
        LOG.info(
            "Dry run: would derive %s attendance row(s) from %s punch(es) in %s group(s).",
            len(attendance_rows),
            len(punch_rows),
            len(groups),
        )
        return 0

    affected = _upsert_attendance_rows(pg_conn, attendance_rows)
    skipped = len(attendance_rows) - affected
    LOG.info(
        "Processed %s punch(es) into %s shift group(s); upserted %s attendance row(s), skipped %s.",
        len(punch_rows),
        len(groups),
        affected,
        skipped,
    )
    return affected
