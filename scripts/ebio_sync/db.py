"""Neon Postgres connection helpers."""

from __future__ import annotations

import logging

from ebio_sync.config import Config

LOG = logging.getLogger("ebio_sync")


def connect_neon(cfg: Config):
    import psycopg  # imported lazily

    LOG.debug("Connecting to Neon Postgres")
    return psycopg.connect(cfg.database_url, autocommit=False)
