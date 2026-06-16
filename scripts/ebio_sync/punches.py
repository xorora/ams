"""Incremental punch sync from Access into Neon."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from ebio_sync.access import SOURCE_QUERY
from ebio_sync.config import Config

LOG = logging.getLogger("ebio_sync")

UPSERT_SQL = """
INSERT INTO machine_punches
    (source_punch_id, card_no, punch_at, machine_no, is_manual,
     machine_emp_code, machine_emp_name, source_emp_id, employee_id, raw_punch_at)
VALUES
    (%(source_punch_id)s, %(card_no)s, %(punch_at)s, %(machine_no)s, %(is_manual)s,
     %(machine_emp_code)s, %(machine_emp_name)s, %(source_emp_id)s, %(employee_id)s, %(raw_punch_at)s)
ON CONFLICT (source_punch_id) DO NOTHING
"""

RELINK_SQL = """
UPDATE machine_punches AS mp
SET employee_id = e.id
FROM employees AS e
WHERE mp.employee_id IS NULL
  AND e.machine_card_no IS NOT NULL
  AND e.machine_card_no = mp.card_no
"""


def get_watermark(pg_conn, full: bool) -> int:
    if full:
        return 0
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MAX(source_punch_id), 0) FROM machine_punches")
        return int(cur.fetchone()[0])


def normalize_punch(row, tz) -> dict:
    (
        punch_id,
        card_no,
        punch_dt,
        machine_no,
        is_manual,
        emp_code,
        emp_name,
        source_emp_id,
    ) = row

    # pyodbc returns a datetime for the DateTime column; treat it as machine-local.
    if isinstance(punch_dt, str):
        punch_dt = datetime.fromisoformat(punch_dt)
    raw_text = punch_dt.replace(tzinfo=None).isoformat(sep=" ")
    punch_at_utc = punch_dt.replace(tzinfo=tz).astimezone(timezone.utc)

    return {
        "source_punch_id": int(punch_id),
        "card_no": str(card_no).strip() if card_no is not None else "",
        "punch_at": punch_at_utc,
        "machine_no": str(machine_no).strip() if machine_no is not None else None,
        "is_manual": str(is_manual).strip().upper() == "Y" if is_manual else False,
        "machine_emp_code": str(emp_code).strip() if emp_code else None,
        "machine_emp_name": str(emp_name).strip() if emp_name else None,
        "source_emp_id": int(source_emp_id) if source_emp_id is not None else None,
        "employee_id": None,
        "raw_punch_at": raw_text,
    }


def sync_punches(
    cfg: Config,
    pg_conn,
    access_conn,
    *,
    full: bool = False,
    dry_run: bool = False,
) -> int:
    """Upsert new punches from Access. Returns the number of rows read."""
    watermark = get_watermark(pg_conn, full)
    LOG.info("Watermark (last synced punch id): %s", watermark)

    cur = access_conn.cursor()
    cur.execute(SOURCE_QUERY, watermark)

    inserted = 0
    seen = 0
    batch: list[dict] = []

    def flush() -> int:
        if not batch:
            return 0
        if dry_run:
            count = len(batch)
            batch.clear()
            return count
        with pg_conn.cursor() as pcur:
            pcur.executemany(UPSERT_SQL, batch)
            affected = pcur.rowcount if pcur.rowcount and pcur.rowcount > 0 else 0
        pg_conn.commit()
        batch.clear()
        return affected

    for row in cur:
        seen += 1
        batch.append(normalize_punch(row, cfg.tz))
        if len(batch) >= cfg.batch_size:
            inserted += flush()
    inserted += flush()

    LOG.info("Read %s new punch(es) from Access; inserted ~%s.", seen, inserted)
    return seen


def relink_punches(pg_conn, *, dry_run: bool = False) -> int:
    """Attach unlinked punches via employees.machine_card_no."""
    if dry_run:
        LOG.info("Dry run: skipping punch relink.")
        return 0

    with pg_conn.cursor() as pcur:
        pcur.execute(RELINK_SQL)
        linked = pcur.rowcount if pcur.rowcount and pcur.rowcount > 0 else 0
    pg_conn.commit()
    if linked:
        LOG.info("Linked %s previously-unlinked punch(es) to employees.", linked)
    return linked
