"""Environment configuration and defaults."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    print("Python 3.9+ is required (zoneinfo).", file=sys.stderr)
    raise

DEFAULT_MDB_PATH = r"C:\Users\shara\Desktop\AMT\attendance_db.mdb"
DEFAULT_MDB_PASSWORD = "attendance@123"
DEFAULT_TIMEZONE = "Asia/Karachi"
DEFAULT_BATCH_SIZE = 500
DEFAULT_SYNC_INTERVAL = 900
DEFAULT_COMPANY_SLUGS = "xorora,crest-led"
DEFAULT_NAME_MATCH_THRESHOLD = 85
DEFAULT_UPDATE_INTERVAL = 21_600  # 6 hours

ACCESS_DRIVER = "{Microsoft Access Driver (*.mdb, *.accdb)}"

# ProgramData path used by the Windows service installer (see install.ps1).
PROGRAM_DATA_DIR = Path(os.environ.get(
    "ProgramData", r"C:\ProgramData")) / "AMSBioSync"


@dataclass
class Config:
    database_url: str
    mdb_path: str
    mdb_password: str
    tz: ZoneInfo
    batch_size: int
    sync_interval: int
    company_slugs: list[str]
    new_employee_company_slug: str
    email_domain_xorora: str
    email_domain_crest_led: str
    name_match_threshold: int
    update_url: str
    update_token: str
    update_interval: int


def _env_file_candidates() -> list[Path]:
    """Search order: service install dir, then scripts/.env next to the package."""
    scripts_dir = Path(__file__).resolve().parent.parent
    return [
        PROGRAM_DATA_DIR / ".env",
        scripts_dir / ".env",
    ]


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


def load_env() -> None:
    for path in _env_file_candidates():
        load_env_file(path)


def build_config() -> Config:
    load_env()

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is not set (env var or .env).")

    tz_name = os.environ.get("EBIO_TIMEZONE", DEFAULT_TIMEZONE).strip()
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            f"Invalid EBIO_TIMEZONE={tz_name!r}: {exc}. "
            "On Windows run `pip install tzdata`."
        ) from exc

    company_slugs_raw = os.environ.get(
        "EBIO_COMPANY_SLUGS", DEFAULT_COMPANY_SLUGS).strip()
    company_slugs = [s.strip()
                     for s in company_slugs_raw.split(",") if s.strip()]
    if not company_slugs:
        company_slugs = DEFAULT_COMPANY_SLUGS.split(",")

    return Config(
        database_url=database_url,
        mdb_path=os.environ.get("EBIO_MDB_PATH", DEFAULT_MDB_PATH).strip(),
        mdb_password=os.environ.get("EBIO_MDB_PASSWORD", DEFAULT_MDB_PASSWORD),
        tz=tz,
        batch_size=int(os.environ.get(
            "EBIO_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))),
        sync_interval=int(os.environ.get(
            "EBIO_SYNC_INTERVAL", str(DEFAULT_SYNC_INTERVAL))),
        company_slugs=company_slugs,
        new_employee_company_slug=os.environ.get(
            "EBIO_NEW_EMPLOYEE_COMPANY_SLUG", company_slugs[0]
        ).strip(),
        email_domain_xorora=os.environ.get(
            "EBIO_EMAIL_DOMAIN_XORORA", "xorora.com").strip(),
        email_domain_crest_led=os.environ.get(
            "EBIO_EMAIL_DOMAIN_CREST_LED", "crestled.com"
        ).strip(),
        name_match_threshold=int(
            os.environ.get("EBIO_NAME_MATCH_THRESHOLD",
                           str(DEFAULT_NAME_MATCH_THRESHOLD))
        ),
        update_url=os.environ.get("EBIO_UPDATE_URL", "").strip().rstrip("/"),
        update_token=os.environ.get("EBIO_UPDATE_TOKEN", "").strip(),
        update_interval=int(
            os.environ.get("EBIO_UPDATE_INTERVAL",
                           str(DEFAULT_UPDATE_INTERVAL))
        ),
    )
