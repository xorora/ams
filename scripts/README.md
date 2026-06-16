# AMS Biometric Sync (Ebio → Neon)

Sync tool and Windows background service for the **AttendanceTracker 11.8
(Ebio)** biometric system. Every sync pass:

1. Matches machine employees to Neon `employees` (card number, persisted mapping,
   exact/fuzzy name) and creates missing profiles
2. Incrementally upserts raw punches into `machine_punches`
3. Relinks punches to employees via `machine_card_no`
4. Derives `attendance_days` rows (source `system`) using per-company shift rules

The service runs unattended on the Windows machine that hosts the Access
database — no Task Scheduler or manual steps after install.

## Prerequisites

1. **Python 3.9+** (`py --version`)
2. **Microsoft Access Database Engine** (ACE ODBC driver) — install the
   [2010 redistributable](https://www.microsoft.com/en-us/download/details.aspx?id=13255)
   matching your Python bitness (64-bit Python → 64-bit driver)
3. Network access to Neon Postgres
4. AMS database migrated (includes `machine_punches`, `biometric_employee_mappings`,
   `employees.machine_card_no`)

## Install (recommended — Windows service)

Run from an **elevated (Administrator)** PowerShell session:

```powershell
cd path\to\ams\scripts
.\install.ps1
```

The installer prompts for all configuration values, writes
`%ProgramData%\AMSBioSync\.env`, installs Python dependencies, and registers
the **AMS Biometric Sync** Windows service (`AMSBioSync`).

| Item | Location |
| --- | --- |
| Service name | `AMSBioSync` |
| Display name | AMS Biometric Sync |
| Config | `%ProgramData%\AMSBioSync\.env` |
| Logs | `%ProgramData%\AMSBioSync\logs\sync.log` |
| Default interval | 15 minutes (`EBIO_SYNC_INTERVAL=900`) |

The service runs as **Local System** by default. If it cannot read
`attendance_db.mdb` (e.g. the file is under a user Desktop), open
`services.msc`, find **AMS Biometric Sync**, and set the logon account to the
desktop user that owns the database file.

### Uninstall

From the `scripts` folder (Admin PowerShell if the service is registered):

```powershell
py -m ebio_sync.service stop
py -m ebio_sync.service remove
```

Remove `%ProgramData%\AMSBioSync` manually if you no longer need config or logs.

## Manual CLI (debugging)

Useful for one-off tests without the Windows service. Copy `.env.example` to
`.env` in this folder (or rely on `%ProgramData%\AMSBioSync\.env` — the config
loader checks ProgramData first).

```powershell
cd path\to\ams\scripts
py -m pip install -r requirements.txt

py ebio_sync.py --once              # one full sync pass
py ebio_sync.py --once --verbose    # debug logging
py ebio_sync.py --dry-run           # read and report, no writes
py ebio_sync.py --full              # re-scan all punches (still idempotent)
py ebio_sync.py --loop --interval 300   # run every 5 min in a console
```

Equivalent module invocation:

```powershell
py -m ebio_sync --once --verbose
```

### Service management (without install.ps1)

```powershell
py -m ebio_sync.service install
py -m ebio_sync.service start
py -m ebio_sync.service stop
py -m ebio_sync.service debug    # console loop, no SCM registration
py -m ebio_sync.service remove
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Neon Postgres connection string |
| `EBIO_MDB_PATH` | no | see `config.py` | Path to `attendance_db.mdb` |
| `EBIO_MDB_PASSWORD` | no | `attendance@123` | Access DB password |
| `EBIO_TIMEZONE` | no | `Asia/Karachi` | Timezone for naive punch timestamps |
| `EBIO_SYNC_INTERVAL` | no | `900` | Seconds between service sync passes |
| `EBIO_COMPANY_SLUGS` | no | `xorora,crest-led` | Companies to search when matching employees |
| `EBIO_NEW_EMPLOYEE_COMPANY_SLUG` | no | first slug | Company for auto-created employees |
| `EBIO_EMAIL_DOMAIN_XORORA` | no | `xorora.com` | Email domain for xorora auto-created employees |
| `EBIO_EMAIL_DOMAIN_CREST_LED` | no | `crestled.com` | Email domain for crest-led auto-created employees |
| `EBIO_NAME_MATCH_THRESHOLD` | no | `85` | Fuzzy name match minimum score (0–100) |
| `EBIO_BATCH_SIZE` | no | `500` | Rows per upsert batch |
| `EBIO_VERBOSE` | no | — | `1`/`true`/`yes` for debug service logging |

Config file search order: `%ProgramData%\AMSBioSync\.env` then `scripts/.env`.
Already-set environment variables are not overwritten by `.env` files.

## How sync works

### Employee matching (per `Mst_Employee` row)

Priority:

1. **Card number** — `CardNo` = `employees.machine_card_no`
2. **Persisted mapping** — `biometric_employee_mappings.source_emp_id`
3. **Normalized exact name** — alphanumeric lowercase match
4. **Fuzzy name** — `rapidfuzz` token_sort_ratio across configured companies;
   highest score wins if ≥ `EBIO_NAME_MATCH_THRESHOLD`
5. **Create new** — insert under `EBIO_NEW_EMPLOYEE_COMPANY_SLUG`

On link: update `machine_card_no` when missing or changed. Mappings are stored in
`biometric_employee_mappings` with `match_method` and optional `match_score`.

### Punch sync

Incremental watermark on `MAX(source_punch_id)` in Neon. Upserts use
`ON CONFLICT DO NOTHING` — reruns are safe with no local state file.

### Attendance derivation

After relink, linked punches are grouped by `(employee_id, shift_date)` using
**per-company shift rules**:

| Company | Shift | Expected in | Expected out | Shift-date boundary |
| --- | --- | --- | --- | --- |
| `crest-led` | Day | 09:00 PKT | 17:00 PKT | Midnight (calendar date) |
| `xorora` | Night | 18:00 PKT | 03:00 PKT (next morning) | Noon (punches before 12:00 belong to previous shift date) |

First punch = check-in, last punch = check-out. Rows are upserted into
`attendance_days` with `source = system`. Same-day check-outs update an existing
system row when a later sync sees more punches. Manual and mobile (`auto`) rows
are never overwritten.

## Package layout

```
scripts/
  install.ps1           # interactive Windows service installer
  ebio_sync.py          # thin CLI wrapper
  requirements.txt
  ebio_sync/
    config.py           # env loading and defaults
    access.py           # ODBC → Access DB
    employees.py        # employee match / create
    punches.py          # punch sync + relink
    attendance.py       # attendance_days derivation
    pipeline.py         # orchestrates one sync pass
    service.py          # Windows service (pywin32)
```

---

## Reverse-engineering notes (Access DB)

The exported install directory (`AttendanceTracker11.8_Ebio/`) is a .NET / VB6
WinForms app that stores data in a **password-protected Microsoft Access (Jet
4.0) database**.

| Item | Value |
| --- | --- |
| Database engine | MS Access / Jet 4.0 (`.mdb`) |
| File | `attendance_db.mdb` |
| Password | `attendance@123` (typical default) |
| Connection string | `Provider=Microsoft.Jet.OLEDB.4.0;…;Jet OLEDB:Database Password=…` |

### Key tables

| Table | What it holds |
| --- | --- |
| **`Tran_MachineRawPunch`** | Raw punches — one row per fingerprint scan (source of truth) |
| `Mst_Employee` | Employee master (`Empid`, `EmpName`, `EmpCode`, `CardNo`) |
| `Tran_Attendance` | App-processed daily attendance (derived; not synced) |
| `Machines` | Device config (IP, port) |

### `Tran_MachineRawPunch` shape

| Column | Notes |
| --- | --- |
| `Tran_MachineRawPunchId` | Autonumber PK → `machine_punches.source_punch_id` |
| `CardNo` | 8-digit zero-padded; joins to `Mst_Employee.CardNo` |
| `PunchDatetime` | Naive local time (configure via `EBIO_TIMEZONE`) |
| `MachineNo` | Device number |
| `ISManual` | `Y` if hand-entered |

There is **no in/out flag** on raw punches — direction is inferred during
attendance processing.

### Neon mirror (`machine_punches`)

```
machine_punches
  source_punch_id   ← Tran_MachineRawPunchId   (UNIQUE)
  card_no           ← CardNo
  punch_at          ← PunchDatetime → UTC timestamptz
  machine_no        ← MachineNo
  is_manual         ← ISManual = 'Y'
  machine_emp_code  ← Mst_Employee.EmpCode
  machine_emp_name  ← Mst_Employee.EmpName
  source_emp_id     ← Mst_Employee.Empid
  employee_id       → employees.id (nullable until linked)
  raw_punch_at      ← original PunchDatetime string (audit)
```

## CSV extract (macOS/Linux dev)

`exports/` (git-ignored, contains PII) can hold dumped tables for offline
analysis. Regenerate with [`mdbtools`](https://github.com/mdbtools/mdbtools):

```bash
mdb-export -D '%Y-%m-%d %H:%M:%S' -T '%Y-%m-%d %H:%M:%S' \
  AttendanceTracker11.8_Ebio/attendance_db.mdb Tran_MachineRawPunch \
  > exports/machine_raw_punches.csv
```
