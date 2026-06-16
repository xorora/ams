"""Windows background service for AMS biometric sync (pywin32).

Install / manage (Admin PowerShell, from the ``scripts`` directory)::

    py -m ebio_sync.service install
    py -m ebio_sync.service start
    py -m ebio_sync.service stop
    py -m ebio_sync.service remove

Debug in a console (runs the service loop without SCM registration)::

    py -m ebio_sync.service debug
"""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Ensure ``scripts/`` is on sys.path when the SCM starts the service from
# an arbitrary working directory.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from ebio_sync.config import PROGRAM_DATA_DIR, Config, build_config  # noqa: E402
from ebio_sync.pipeline import run_once  # noqa: E402

LOG = logging.getLogger("ebio_sync.service")

SERVICE_NAME = "AMSBioSync"
SERVICE_DISPLAY_NAME = "AMS Biometric Sync"
SERVICE_DESCRIPTION = (
    "Syncs biometric employee data and punches from the local Access database "
    "into Neon Postgres on a fixed interval."
)

LOG_DIR = PROGRAM_DATA_DIR / "logs"
LOG_FILE = LOG_DIR / "sync.log"
LOG_MAX_BYTES = 5 * 1024 * 1024
LOG_BACKUP_COUNT = 5


def configure_service_logging(*, verbose: bool = False) -> None:
    """Rotating file log under ``%ProgramData%\\AMSBioSync\\logs\\sync.log``."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    level = logging.DEBUG if verbose else logging.INFO
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

    root = logging.getLogger("ebio_sync")
    root.setLevel(level)
    root.handlers.clear()

    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)


def _is_verbose() -> bool:
    return os.environ.get("EBIO_VERBOSE", "").strip().lower() in {"1", "true", "yes"}


def _log_event_error(message: str) -> None:
    """Write a failure line to the Windows Application event log."""
    if sys.platform != "win32":
        return
    try:
        import servicemanager

        servicemanager.LogErrorMsg(message)
    except Exception:  # noqa: BLE001 - best-effort when not running under SCM
        pass


if sys.platform == "win32":
    import servicemanager
    import win32event
    import win32service
    import win32serviceutil

    def _run_sync_loop(stop_event, cfg: Config) -> None:
        """Run ``pipeline.run_once`` repeatedly until *stop_event* is signaled."""
        interval_sec = max(5, cfg.sync_interval)
        full = False

        LOG.info(
            "Service loop started | interval=%ss | mdb=%s | tz=%s | log=%s",
            interval_sec,
            cfg.mdb_path,
            cfg.tz.key,
            LOG_FILE,
        )

        while True:
            if win32event.WaitForSingleObject(stop_event, 0) == win32event.WAIT_OBJECT_0:
                LOG.info("Stop requested before sync pass; exiting loop.")
                break

            try:
                LOG.info("Starting sync pass (full=%s).", full)
                results = run_once(cfg, full=full, dry_run=False)
                LOG.info("Sync pass complete: %s", results)
                full = False
            except Exception as exc:  # noqa: BLE001 - keep the service alive
                LOG.exception("Sync pass failed.")
                _log_event_error(f"{SERVICE_NAME}: sync pass failed: {exc}")

            rc = win32event.WaitForSingleObject(stop_event, interval_sec * 1000)
            if rc == win32event.WAIT_OBJECT_0:
                LOG.info("Stop signal received; exiting sync loop.")
                break

    class AMSBioSyncService(win32serviceutil.ServiceFramework):
        """Sync Access biometric data to Neon every ``EBIO_SYNC_INTERVAL`` seconds."""

        _svc_name_ = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY_NAME
        _svc_description_ = SERVICE_DESCRIPTION

        def __init__(self, args: list[str]) -> None:
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)

        def SvcStop(self) -> None:
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            win32event.SetEvent(self.stop_event)

        def SvcDoRun(self) -> None:
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, ""),
            )
            try:
                self.main()
            except Exception as exc:
                _log_event_error(f"{SERVICE_NAME} terminated unexpectedly: {exc}")
                LOG.exception("Service main loop exited with error.")
                raise
            finally:
                servicemanager.LogMsg(
                    servicemanager.EVENTLOG_INFORMATION_TYPE,
                    servicemanager.PYS_SERVICE_STOPPED,
                    (self._svc_name_, ""),
                )

        def main(self) -> None:
            configure_service_logging(verbose=_is_verbose())
            try:
                cfg = build_config()
            except SystemExit as exc:
                msg = f"{SERVICE_NAME}: configuration error: {exc}"
                LOG.error(msg)
                _log_event_error(msg)
                raise

            _run_sync_loop(self.stop_event, cfg)


def main() -> int:
    if sys.platform != "win32":
        print(
            f"{SERVICE_DISPLAY_NAME} requires Windows and pywin32.",
            file=sys.stderr,
        )
        return 1

    win32serviceutil.HandleCommandLine(AMSBioSyncService)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
