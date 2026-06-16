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

ACCESS_PUNCH_STATS_QUERY = """
SELECT COALESCE(MAX(p.Tran_MachineRawPunchId), 0),
       COALESCE(SUM(IIF(p.PunchDatetime IS NULL, 1, 0)), 0)
FROM Tran_MachineRawPunch AS p
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
    cur.execute(ACCESS_PUNCH_STATS_QUERY)
    row = cur.fetchone()
    return int(row[0]), int(row[1])
