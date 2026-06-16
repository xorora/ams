"""CLI entry point: python -m ebio_sync"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from ebio_sync.config import build_config
from ebio_sync.pipeline import run_once

LOG = logging.getLogger("ebio_sync")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync Ebio Access punches into Neon.")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one sync pass and exit (default when --loop is not set).",
    )
    parser.add_argument("--full", action="store_true", help="Re-scan all punches (idempotent).")
    parser.add_argument("--loop", action="store_true", help="Run continuously.")
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Loop interval seconds (default: EBIO_SYNC_INTERVAL or 900).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Read and report only; no writes.")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    cfg = build_config()
    interval = args.interval if args.interval is not None else cfg.sync_interval
    LOG.info("MDB: %s | TZ: %s | dry_run=%s", cfg.mdb_path, cfg.tz.key, args.dry_run)

    if not args.loop:
        run_once(cfg, full=args.full, dry_run=args.dry_run)
        return 0

    LOG.info("Entering loop mode every %ss. Ctrl+C to stop.", interval)
    full = args.full
    while True:
        try:
            run_once(cfg, full=full, dry_run=args.dry_run)
            full = False
        except KeyboardInterrupt:
            LOG.info("Interrupted; exiting.")
            return 0
        except Exception:  # noqa: BLE001 - keep the loop alive on transient errors
            LOG.exception("Sync pass failed; will retry next interval.")
        time.sleep(max(5, interval))


if __name__ == "__main__":
    raise SystemExit(main())
