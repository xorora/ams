# Ebio biometric → Neon sync

Reverse-engineering notes and the sync tool for the **AttendanceTracker 11.8
(Ebio)** biometric system (RealTime Biometrics, machine type EN-Finger).

## 1. What the system is and where the data lives

The exported install directory (`AttendanceTracker11.8_Ebio/`) is a .NET / VB6
WinForms app (`AttendanceTracker11.8.exe`) that talks to RealTime / ZK style
fingerprint devices and stores everything in a **password-protected Microsoft
Access (Jet 4.0) database**.

| Item | Value |
| --- | --- |
| Database engine | MS Access / Jet 4.0 (`.mdb`) |
| File | `attendance_db.mdb` (in the app's working dir) |
| Connection string | `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=\|DataDirectory\|\attendance_db.mdb;Jet OLEDB:Database Password=attendance@123` |
| Password | `attendance@123` |
| Install dir (this machine) | `C:\Users\shara\Desktop\AMT` (from `config.ini`) |
| Configured device | `AR-28` @ `192.168.1.110:5005` (from the `Machines` table) |

The connection string was found in `AttendanceTracker11.8.exe.config`
(`connectionStrings` → `attendance_dbConnectionString`). The app can also be
pointed at SQL Server (other connection strings in that file reference
`SQLEXPRESS` / `RealSoft_Desktop`), but this deployment uses the Access file.

### Key tables (49 total)

| Table | Rows | What it holds |
| --- | --- | --- |
| **`Tran_MachineRawPunch`** | ~1.6k | **The raw punches** — one row per fingerprint scan. This is the source of truth we sync. |
| `Mst_Employee` | 16 | Employee master (Empid, EmpName, EmpCode, **CardNo**). |
| `Tran_Attendance` | ~1.3k | The app's *processed* daily attendance (shift, IN1/OUT1…, status). Derived data. |
| `Machines` / `mst_machineType1` | 2 | Device config (IP, port, password). |
| `tblEnroll` | 540 | Fingerprint templates per enroll number. |

### `Tran_MachineRawPunch` shape

Raw punches only populate a handful of columns; the rest are filled later by the
app's attendance-processing step:

| Column | Example | Notes |
| --- | --- | --- |
| `Tran_MachineRawPunchId` | `441` | Autonumber PK → our idempotency key. |
| `CardNo` | `00000061` | 8-digit zero-padded; **joins to `Mst_Employee.CardNo`**. |
| `PunchDatetime` | `2026-03-02 09:21:11` | **Naive local time** (Asia/Karachi). |
| `MachineNo` | `1` | Device number. |
| `ISManual` | `N` | `Y` if hand-entered. |

There is **no in/out flag** on raw punches — the device just records scans and
the desktop app infers direction during processing.

## 2. The CSV extract

`exports/` (git-ignored, contains PII) holds the dumped tables:

- `machine_raw_punches.csv` — every raw punch (the important one)
- `employees_master.csv` — `Mst_Employee`
- `tran_attendance.csv` — the app's processed attendance
- `machines.csv` — device config

Regenerate on macOS/Linux with [`mdbtools`](https://github.com/mdbtools/mdbtools):

```bash
mdb-export -D '%Y-%m-%d %H:%M:%S' -T '%Y-%m-%d %H:%M:%S' \
  AttendanceTracker11.8_Ebio/attendance_db.mdb Tran_MachineRawPunch \
  > exports/machine_raw_punches.csv
```

## 3. How it syncs into our Neon database

Raw punches are mirrored into a dedicated `machine_punches` table in Neon
(added to `src/db/schema.ts`, migration `drizzle/0007_*`):

```
machine_punches
  source_punch_id   ← Tran_MachineRawPunchId   (UNIQUE, idempotency key)
  card_no           ← CardNo
  punch_at          ← PunchDatetime, converted Asia/Karachi → UTC (timestamptz)
  machine_no        ← MachineNo
  is_manual         ← ISManual = 'Y'
  machine_emp_code  ← Mst_Employee.EmpCode  (joined on CardNo)
  machine_emp_name  ← Mst_Employee.EmpName
  source_emp_id     ← Mst_Employee.Empid
  employee_id       → employees.id (best-effort link, nullable)
  raw_punch_at      ← original PunchDatetime string (audit)
```

### Why a raw mirror instead of writing `attendance_days` directly?

The machine's `EmpCode`/`CardNo` (`61`, `00000061`) do **not** match the AMS
`employees.employee_code` (`001…010`, `@xorora.com` emails). There is no
reliable automatic mapping, so the sync stays "dumb and safe": it copies raw
punches verbatim and never guesses attendance. To connect a punch to an AMS
employee, set the new **`employees.machine_card_no`** column to the device card
(e.g. `00000061`). The sync then auto-links matching punches on every run
(and back-links existing ones).

## 4. Running the sync on the Windows machine

Prerequisites:

1. **Python 3.9+** (`py --version`).
2. **Microsoft Access Database Engine** (the ACE/Jet ODBC driver) — install the
   [2010 redistributable](https://www.microsoft.com/en-us/download/details.aspx?id=13255)
   matching your Python bitness (64-bit Python → 64-bit driver).
3. Install deps:

   ```powershell
   cd path\to\ams\scripts
   py -m pip install -r requirements.txt
   ```

4. Configure: copy `.env.example` → `.env` and fill in `DATABASE_URL`,
   `EBIO_MDB_PATH`, etc.

Run it:

```powershell
py ebio_sync.py            # one incremental sync (good for Task Scheduler)
py ebio_sync.py --dry-run  # read & report, write nothing
py ebio_sync.py --full     # re-scan all punches (still idempotent)
py ebio_sync.py --loop --interval 300   # run forever, every 5 min
```

The sync is **incremental and idempotent**: it reads
`MAX(source_punch_id)` from Neon as the high-water mark and upserts newer rows
with `ON CONFLICT DO NOTHING`, so duplicate runs are harmless and no local state
file is needed.

### Schedule it (recommended)

Use **Task Scheduler** → Create Task → trigger every 5–10 min → action:

- Program: `py` (or the full `python.exe` path)
- Arguments: `ebio_sync.py`
- Start in: the `scripts` folder

Or keep a console open with `--loop`.
