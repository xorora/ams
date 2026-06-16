#!/usr/bin/env python3
"""Thin CLI wrapper — delegates to the ebio_sync package.

Prefer running directly: python -m ebio_sync
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _bootstrap_package() -> None:
    """Load ebio_sync/ as a package without this file shadowing it."""
    pkg_dir = Path(__file__).resolve().parent / "ebio_sync"
    spec = importlib.util.spec_from_file_location(
        "ebio_sync",
        pkg_dir / "__init__.py",
        submodule_search_locations=[str(pkg_dir)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load ebio_sync package from {pkg_dir}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["ebio_sync"] = module
    spec.loader.exec_module(module)


if __name__ == "__main__":
    _bootstrap_package()
    from ebio_sync.__main__ import main

    raise SystemExit(main())
