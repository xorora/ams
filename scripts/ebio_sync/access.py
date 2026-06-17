"""Microsoft Access (ODBC) connection and queries."""

from __future__ import annotations

import logging
from pathlib import Path

from ebio_sync.config import ACCESS_DRIVER, Config

LOG = logging.getLogger("ebio_sync")

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

ACCESS_MAX_PUNCH_ID_QUERY = """
SELECT MAX(p.Tran_MachineRawPunchId)
FROM Tran_MachineRawPunch AS p
"""

ACCESS_NULL_PUNCH_DATETIME_COUNT_QUERY = """
SELECT COUNT(*)
FROM Tran_MachineRawPunch AS p
WHERE p.PunchDatetime IS NULL
"""

EMPLOYEE_QUERY = """
SELECT e.Empid,
       e.EmpCode,
       e.EmpName,
       e.CardNo
FROM Mst_Employee AS e
WHERE e.CardNo IS NOT NULL
ORDER BY e.Empid
"""


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


def fetch_employees(access_conn):
    """Return all machine employees with a card number."""
    cur = access_conn.cursor()
    cur.execute(EMPLOYEE_QUERY)
    return cur.fetchall()


def get_access_punch_stats(access_conn) -> tuple[int, int]:
    """Return (max Tran_MachineRawPunchId, rows with NULL PunchDatetime) in Access."""
    cur = access_conn.cursor()
    cur.execute(ACCESS_MAX_PUNCH_ID_QUERY)
    max_id = cur.fetchone()[0]

    cur.execute(ACCESS_NULL_PUNCH_DATETIME_COUNT_QUERY)
    null_datetime_rows = cur.fetchone()[0]

    return int(max_id or 0), int(null_datetime_rows or 0)
