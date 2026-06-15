"""Sync biometric punches from the AttendanceTracker 11.8 (Ebio) Access database
into the AMS Neon Postgres database.

This is meant to run on the Windows machine where AttendanceTracker 11.8 is
installed. It reads new rows from the `Tran_MachineRawPunch` table inside the
password-protected `attendance_db.mdb` (MS Access / Jet) file and upserts them
into the `machine_punches` table in Neon.

Design notes
------------
* The sync is incremental and idempotent. The high-water mark is
  ``MAX(source_punch_id)`` read from Neon, so no local state file is needed and
  re-runs never create duplicates (``ON CONFLICT (source_punch_id) DO NOTHING``).
* Raw punches only carry a CardNo + timestamp, so each row is joined against
  `Mst_Employee` (on CardNo) to attach the machine's EmpCode / EmpName / Empid.
* The machine stores naive local timestamps. They are interpreted in
  ``EBIO_TIMEZONE`` (default Asia/Karachi) and converted to UTC for storage in
  the ``timestamptz`` column.
* After each run, any unlinked punch is best-effort linked to an AMS employee
  via ``employees.machine_card_no`` so links self-heal as admins map cards.

Usage
-----
    python ebio_sync.py                 # one incremental sync, then exit
    python ebio_sync.py --full          # re-scan every punch (still idempotent)
    python ebio_sync.py --loop --interval 300   # run forever, every 5 minutes
    python ebio_sync.py --dry-run       # read + report, write nothing

Configuration is read from environment variables and/or a `.env` file located
next to this script (see `.env.example`).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    print("Python 3.9+ is required (zoneinfo).", file=sys.stderr)
    raise

LOG = logging.getLogger("ebio_sync")

DEFAULT_MDB_PATH = r"C:\Users\shara\Desktop\AMT\attendance_db.mdb"
DEFAULT_MDB_PASSWORD = "attendance@123"
DEFAULT_TIMEZONE = "Asia/Karachi"
ACCESS_DRIVER = "{Microsoft Access Driver (*.mdb, *.accdb)}"

# Pull new raw punches and resolve the employee from the machine's own master.
SOURCE_QUERY = """
SELECT p.Tran_MachineRawPunchId,
       p.CardNo,
       p.PunchDatetime,
       p.MachineNo,
       p.ISManual,
       e.EmpCode,
       e.EmpName,
       e.Empid
FROM Tran_MachineRawPunch AS p
LEFT JOIN Mst_Employee AS e ON p.CardNo = e.CardNo
WHERE p.Tran_MachineRawPunchId > ?
  AND p.PunchDatetime IS NOT NULL
ORDER BY p.Tran_MachineRawPunchId
"""

UPSERT_SQL = """
INSERT INTO machine_punches
    (source_punch_id, card_no, punch_at, machine_no, is_manual,
     machine_emp_code, machine_emp_name, source_emp_id, employee_id, raw_punch_at)
VALUES
    (%(source_punch_id)s, %(card_no)s, %(punch_at)s, %(machine_no)s, %(is_manual)s,
     %(machine_emp_code)s, %(machine_emp_name)s, %(source_emp_id)s, %(employee_id)s, %(raw_punch_at)s)
ON CONFLICT (source_punch_id) DO NOTHING
"""

# Self-healing link: attach punches to employees as card mappings are created.
RELINK_SQL = """
UPDATE machine_punches AS mp
SET employee_id = e.id
FROM employees AS e
WHERE mp.employee_id IS NULL
  AND e.machine_card_no IS NOT NULL
  AND e.machine_card_no = mp.card_no
"""


@dataclass
class Config:
    database_url: str
    mdb_path: str
    mdb_password: str
    tz: ZoneInfo
    batch_size: int


def load_env_file(path: Path) -> None:
    """Minimal .env loader (does not overwrite already-set env vars)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def build_config() -> Config:
    load_env_file(Path(__file__).with_name(".env"))

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is not set (env var or scripts/.env).")

    # Neon's pooled URL uses channel_binding which libpq/psycopg handles fine,
    # but strip it defensively if a non-supporting build complains.
    tz_name = os.environ.get("EBIO_TIMEZONE", DEFAULT_TIMEZONE).strip()
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            f"Invalid EBIO_TIMEZONE={tz_name!r}: {exc}. "
            "On Windows run `pip install tzdata`."
        ) from exc

    return Config(
        database_url=database_url,
        mdb_path=os.environ.get("EBIO_MDB_PATH", DEFAULT_MDB_PATH).strip(),
        mdb_password=os.environ.get("EBIO_MDB_PASSWORD", DEFAULT_MDB_PASSWORD),
        tz=tz,
        batch_size=int(os.environ.get("EBIO_BATCH_SIZE", "500")),
    )


def connect_access(cfg: Config):
    import pyodbc  # type: ignore

    if not Path(cfg.mdb_path).exists():
        raise SystemExit(f"Access database not found: {cfg.mdb_path}")

    conn_str = (
        f"DRIVER={ACCESS_DRIVER};"
        f"DBQ={cfg.mdb_path};"
        f"PWD={cfg.mdb_password};"
        "ReadOnly=1;"
    )
    LOG.debug("Connecting to Access: %s", cfg.mdb_path)
    return pyodbc.connect(conn_str, autocommit=True)


def connect_neon(cfg: Config):
    import psycopg  # imported lazily

    LOG.debug("Connecting to Neon Postgres")
    return psycopg.connect(cfg.database_url, autocommit=False)


def get_watermark(pg_conn, full: bool) -> int:
    if full:
        return 0
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MAX(source_punch_id), 0) FROM machine_punches")
        return int(cur.fetchone()[0])


def normalize_punch(row, tz: ZoneInfo) -> dict:
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


def sync_once(cfg: Config, *, full: bool, dry_run: bool) -> int:
    pg_conn = None
    access_conn = None
    try:
        pg_conn = connect_neon(cfg)
        watermark = get_watermark(pg_conn, full)
        LOG.info("Watermark (last synced punch id): %s", watermark)

        access_conn = connect_access(cfg)
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

        if not dry_run:
            with pg_conn.cursor() as pcur:
                pcur.execute(RELINK_SQL)
                linked = pcur.rowcount if pcur.rowcount and pcur.rowcount > 0 else 0
            pg_conn.commit()
            if linked:
                LOG.info("Linked %s previously-unlinked punch(es) to employees.", linked)

        return seen
    finally:
        if access_conn is not None:
            access_conn.close()
        if pg_conn is not None:
            pg_conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync Ebio Access punches into Neon.")
    parser.add_argument("--full", action="store_true", help="Re-scan all punches (idempotent).")
    parser.add_argument("--loop", action="store_true", help="Run continuously.")
    parser.add_argument("--interval", type=int, default=300, help="Loop interval seconds (default 300).")
    parser.add_argument("--dry-run", action="store_true", help="Read and report only; no writes.")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    cfg = build_config()
    LOG.info("MDB: %s | TZ: %s | dry_run=%s", cfg.mdb_path, cfg.tz.key, args.dry_run)

    if not args.loop:
        sync_once(cfg, full=args.full, dry_run=args.dry_run)
        return 0

    LOG.info("Entering loop mode every %ss. Ctrl+C to stop.", args.interval)
    full = args.full
    while True:
        try:
            sync_once(cfg, full=full, dry_run=args.dry_run)
            full = False  # only the first pass honors --full
        except KeyboardInterrupt:
            LOG.info("Interrupted; exiting.")
            return 0
        except Exception:  # noqa: BLE001 - keep the loop alive on transient errors
            LOG.exception("Sync pass failed; will retry next interval.")
        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
