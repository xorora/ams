"""Download and apply AMS biometric sync updates from the deployed AMS app."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from ebio_sync import __version__ as LOCAL_VERSION
from ebio_sync.config import PROGRAM_DATA_DIR, Config

LOG = logging.getLogger("ebio_sync.updater")

APP_DIR = PROGRAM_DATA_DIR / "app"
STAGING_DIR = PROGRAM_DATA_DIR / "app_staging"
BACKUP_DIR = PROGRAM_DATA_DIR / "app_backup"
UPDATES_DIR = PROGRAM_DATA_DIR / "updates"
RESTART_SCRIPT = PROGRAM_DATA_DIR / "restart_service.ps1"

MANIFEST_PATH = "/api/sync-agent/manifest"
BUNDLE_PATH = "/api/sync-agent/bundle"
DEFAULT_UPDATE_INTERVAL = 21_600  # 6 hours


def parse_version(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in version.strip().split("."):
        digits = "".join(ch for ch in piece if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def is_newer_version(remote: str, local: str) -> bool:
    return parse_version(remote) > parse_version(local)


def _auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": f"AMSBioSync/{LOCAL_VERSION}",
    }


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}{path}"


def fetch_manifest(cfg: Config) -> dict[str, Any] | None:
    if not cfg.update_url:
        LOG.debug("EBIO_UPDATE_URL is not set; skipping update check.")
        return None

    url = _join_url(cfg.update_url, MANIFEST_PATH)
    request = urllib.request.Request(url, method="GET")

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Failed to fetch manifest from {url}: {exc}") from exc

    try:
        manifest = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("Manifest response was not valid JSON.") from exc

    if not isinstance(manifest, dict) or "version" not in manifest:
        raise RuntimeError("Manifest response is missing a version field.")

    return manifest


def download_bundle(cfg: Config, manifest: dict[str, Any], destination: Path) -> None:
    if not cfg.update_token:
        raise RuntimeError(
            "EBIO_UPDATE_TOKEN is required to download update bundles.")

    url = _join_url(cfg.update_url, BUNDLE_PATH)
    request = urllib.request.Request(
        url, headers=_auth_headers(cfg.update_token), method="GET")

    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Bundle download failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Failed to download bundle from {url}: {exc}") from exc

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)

    expected_sha = str(manifest.get("sha256", "")).strip()
    if expected_sha:
        actual_sha = hashlib.sha256(payload).hexdigest()
        if actual_sha != expected_sha:
            destination.unlink(missing_ok=True)
            raise RuntimeError("Downloaded bundle failed sha256 verification.")


def _resolve_python_command() -> list[str]:
    for candidate in (
        ["py", "-3"],
        ["py"],
        ["python"],
        ["python3"],
    ):
        try:
            result = subprocess.run(
                [*candidate, "-c", "import sys; print(sys.executable)"],
                check=True,
                capture_output=True,
                text=True,
            )
        except (OSError, subprocess.CalledProcessError):
            continue

        executable = result.stdout.strip()
        if executable:
            return [*candidate]

    raise RuntimeError("Python interpreter not found for dependency install.")


def _install_requirements(target_dir: Path) -> None:
    requirements = target_dir / "requirements.txt"
    if not requirements.exists():
        raise RuntimeError(
            f"requirements.txt not found in staged update: {requirements}")

    python_cmd = _resolve_python_command()
    LOG.info("Installing Python dependencies into staged update...")
    subprocess.run(
        [*python_cmd, "-m", "pip", "install", "-r", str(requirements)],
        check=True,
    )


def _extract_bundle(bundle_path: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)

    destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(bundle_path, "r") as archive:
        members = [name for name in archive.namelist()
                   if name.startswith("app/")]
        if not members:
            raise RuntimeError(
                "Update bundle does not contain an app/ directory.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            archive.extractall(tmp_path)
            extracted_app = tmp_path / "app"
            if not extracted_app.exists():
                raise RuntimeError("Update bundle extraction failed.")

            for child in extracted_app.iterdir():
                target = destination / child.name
                if child.is_dir():
                    shutil.copytree(child, target)
                else:
                    shutil.copy2(child, target)


def _swap_app_directories(staging_dir: Path) -> None:
    if BACKUP_DIR.exists():
        shutil.rmtree(BACKUP_DIR)

    if APP_DIR.exists():
        APP_DIR.rename(BACKUP_DIR)

    try:
        staging_dir.rename(APP_DIR)
    except Exception:
        if BACKUP_DIR.exists() and not APP_DIR.exists():
            BACKUP_DIR.rename(APP_DIR)
        raise

    if BACKUP_DIR.exists():
        shutil.rmtree(BACKUP_DIR, ignore_errors=True)


def _write_restart_script() -> None:
    script = f"""
$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 3
try {{
    Stop-Service -Name AMSBioSync -Force -ErrorAction Stop
}} catch {{
    Write-Host "Stop-Service failed: $_"
}}
Start-Sleep -Seconds 2
Start-Service -Name AMSBioSync
"""
    RESTART_SCRIPT.write_text(script.strip() + "\n", encoding="utf-8")


def schedule_service_restart() -> None:
    if sys.platform != "win32":
        LOG.info("Service restart skipped (not Windows).")
        return

    _write_restart_script()
    creationflags = 0
    if hasattr(subprocess, "DETACHED_PROCESS"):
        creationflags |= subprocess.DETACHED_PROCESS
    if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP

    subprocess.Popen(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(RESTART_SCRIPT),
        ],
        creationflags=creationflags,
        close_fds=True,
    )
    LOG.info("Scheduled AMSBioSync service restart.")


def apply_update(cfg: Config, manifest: dict[str, Any]) -> bool:
    remote_version = str(manifest["version"])
    LOG.info("Applying update %s -> %s", LOCAL_VERSION, remote_version)

    UPDATES_DIR.mkdir(parents=True, exist_ok=True)
    bundle_path = UPDATES_DIR / f"bundle-{remote_version}.zip"

    download_bundle(cfg, manifest, bundle_path)

    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)

    _extract_bundle(bundle_path, STAGING_DIR)
    _install_requirements(STAGING_DIR)
    _swap_app_directories(STAGING_DIR)

    LOG.info("Update %s installed successfully.", remote_version)
    return True


def check_for_update(cfg: Config) -> dict[str, Any] | None:
    manifest = fetch_manifest(cfg)
    if manifest is None:
        return None

    remote_version = str(manifest["version"])
    if not is_newer_version(remote_version, LOCAL_VERSION):
        LOG.info(
            "No update available (local=%s, remote=%s).",
            LOCAL_VERSION,
            remote_version,
        )
        return None

    LOG.info("Update available: %s -> %s", LOCAL_VERSION, remote_version)
    return manifest


def check_and_apply(cfg: Config, *, restart: bool = True) -> bool:
    if not cfg.update_url:
        return False

    manifest = check_for_update(cfg)
    if manifest is None:
        return False

    apply_update(cfg, manifest)
    if restart:
        schedule_service_restart()
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Check for and apply AMSBioSync updates.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check for updates and print the result without applying.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply an update if a newer version is available.",
    )
    parser.add_argument(
        "--no-restart",
        action="store_true",
        help="Do not schedule a Windows service restart after applying.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    from ebio_sync.config import build_config

    cfg = build_config()

    if args.check:
        manifest = check_for_update(cfg)
        if manifest is None:
            print(f"Up to date (v{LOCAL_VERSION}).")
            return 0
        print(
            json.dumps(
                {
                    "local_version": LOCAL_VERSION,
                    "remote_version": manifest["version"],
                    "update_available": True,
                },
                indent=2,
            )
        )
        return 0

    if args.apply:
        manifest = check_for_update(cfg)
        if manifest is None:
            print(f"No update applied (current v{LOCAL_VERSION}).")
            return 0

        remote_version = str(manifest["version"])
        apply_update(cfg, manifest)
        if not args.no_restart:
            schedule_service_restart()
        print(f"Updated to v{remote_version}.")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
