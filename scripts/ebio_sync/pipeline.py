"""Orchestrate one full biometric sync pass."""

from __future__ import annotations

import logging

from ebio_sync.access import connect_access
from ebio_sync.attendance import process_attendance
from ebio_sync.config import Config
from ebio_sync.db import connect_neon
from ebio_sync.employees import sync_employees
from ebio_sync.punches import relink_punches, sync_punches

LOG = logging.getLogger("ebio_sync")


def run_once(cfg: Config, *, full: bool = False, dry_run: bool = False) -> dict[str, int]:
    """Run employee sync → punch sync → relink → attendance in order."""
    pg_conn = None
    access_conn = None
    results: dict[str, int] = {}

    try:
        pg_conn = connect_neon(cfg)
        access_conn = connect_access(cfg)

        try:
            results["employees"] = sync_employees(
                cfg, pg_conn, access_conn, dry_run=dry_run
            )
        except Exception:  # noqa: BLE001 - keep the service alive on step failure
            LOG.exception("Employee sync failed.")

        try:
            results["punches_read"] = sync_punches(
                cfg, pg_conn, access_conn, full=full, dry_run=dry_run
            )
        except Exception:
            LOG.exception("Punch sync failed.")

        try:
            results["punches_linked"] = relink_punches(pg_conn, dry_run=dry_run)
        except Exception:
            LOG.exception("Punch relink failed.")

        try:
            results["attendance"] = process_attendance(cfg, pg_conn, dry_run=dry_run)
        except Exception:
            LOG.exception("Attendance processing failed.")

        return results
    finally:
        if access_conn is not None:
            access_conn.close()
        if pg_conn is not None:
            pg_conn.close()
