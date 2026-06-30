# AMS ↔ ZKTime Bridge — Deduplication Guidelines

This document describes how the **Xorora ZKTime bridge** (`xorora-zktime-bridge`) deduplicates data when AMS pushes to or pulls from the Lahore server. Follow these rules when implementing or calling AMS sync routes.

---

## Overview

```
AMS (Vercel)
    │  POST /api/sync/employees     (push)
    │  GET  /api/sync/attendance    (pull)
    ▼
Tailscale Funnel → Bridge API (8090)
    ▼
ZKTime att2000.mdb → K40 device
```

The bridge is the **single source of truth** for deduplication on the ZKTime side. AMS should still deduplicate attendance when **saving** to its own database.

---

## Push: employees & departments → device

### Endpoint

```
POST https://ams.xorora.com/api/sync/employees
Authorization: Bearer <AMS_CRON_SECRET>
Content-Type: application/json
```

Or call the bridge directly:

```
POST https://lahore-server.tailca4ca9.ts.net/api/v1/sync/master-data
Authorization: Bearer <ZKTIME_API_KEY>
```

### Required payload shape

Always send **departments before employees** in the same request:

```json
{
  "departments": [
    { "id": 2, "name": "Drivers" },
    { "id": 3, "name": "Operations" }
  ],
  "employees": [
    {
      "emp_code": "011",
      "full_name": "Ijaz Driver",
      "department_id": 2,
      "department_name": "Drivers"
    }
  ],
  "queue_to_device": true
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `departments[].id` | Yes | AMS department ID (stored in bridge mapping) |
| `departments[].name` | Yes | Max 30 chars; matched to ZKTime `DEPTNAME` |
| `employees[].emp_code` | Yes | Maps to ZKTime `Badgenumber` |
| `employees[].full_name` | Yes | Max 40 chars |
| `employees[].department_id` | Yes | AMS dept ID — must match a row in `departments` |
| `employees[].department_name` | Yes | Used to create/find ZKTime department |
| `queue_to_device` | No | Default `true`; set `false` to update DB only |

---

## What the bridge deduplicates (push)

### Departments

| Condition | Bridge action |
|-----------|---------------|
| Same AMS id + same ZKTime dept already mapped | **Skip** — `sync_action: "unchanged"` |
| Name exists in ZKTime but mapping is new | Reuse dept row, update mapping |
| Name does not exist | Create new `DEPARTMENTS` row |

Departments are matched by **name**, not AMS id. Two AMS departments with the same name resolve to one ZKTime department.

### Employees

| Condition | DB write | Device queue (`UserUpdates`) |
|-----------|----------|------------------------------|
| Badge **new** | Insert | **Yes** |
| Badge exists, **same name + dept**, linked to K40 | Skip | **No** |
| Badge exists, **name or dept changed** | Update | **Yes** |
| Badge exists, **not linked** to K40 | No data change | **Yes** (link only) |

Join key: **`emp_code`** ↔ ZKTime **`Badgenumber`**.

### Full re-push from AMS

When AMS sends all employees again with unchanged data:

- Expect `skipped_unchanged` ≈ total employee count
- Expect `queued_for_device: 0`
- No duplicate rows in `USERINFO` or `UsersMachines`

Example response:

```json
{
  "source": "zktime",
  "pushed": 22,
  "queuedForDevice": 0,
  "skippedUnchanged": 22,
  "employees": [
    {
      "emp_code": "011",
      "full_name": "Ijaz Driver",
      "sync_action": "unchanged",
      "queued_for_device": false
    }
  ]
}
```

### Per-employee response fields

| Field | Values | Meaning |
|-------|--------|---------|
| `sync_action` | `created` \| `updated` \| `unchanged` | What the bridge did in ZKTime |
| `queued_for_device` | `true` \| `false` | Whether a device download was queued |

---

## Pull: attendance ← ZKTime

### Endpoint

GET https://ams.xorora.com/api/sync/attendance?since=<timestamp>
Authorization: Bearer <AMS_CRON_SECRET>

### Incremental sync rules

1. **First sync / backfill:** use since=2000-01-01 00:00:00 or start of day local: 2026-06-30 00:00:00.
2. **Later syncs:** store and pass **next_since** from the previous bridge response — **not** latest_punch_time or latestUploadTime directly.
3. **Do not** pass current timestamp as since — that returns 0 records.

The bridge uses **exclusive** filtering: CHECKTIME > since.

Example export response:

json
{
  "count": 3,
  "data": [ /* punches */ ],
  "since_requested": "2026-06-30 00:00:00",
  "since_parsed_local": "2026-06-30 00:00:00",
  "latest_punch_time": "2026-06-30 22:04:11",
  "next_since": "2026-06-30 22:04:11"
}

Next cron call:

GET /api/sync/attendance?since=2026-06-30%2022:04:11

That returns only punches **after** 22:04:11 (none yet), avoiding duplicates.

ISO-8601 UTC is supported (2026-06-30T17:04:11Z → converted to server local time).

### One-time backfill if punches were missed

If AMS previously used a since cursor that was too far ahead (e.g. last punch time before earlier punches were synced), reset once:

GET /api/sync/attendance?since=2026-06-30%2000:00:00

Then resume using next_since from each response.

### AMS-side deduplication (required)

The bridge may return the same punch twice if `since` equals the last punch time. **AMS must deduplicate when saving:**

```
Unique key: (emp_code, punch_time)
```

Suggested Prisma upsert:

```typescript
await prisma.attendanceRecord.upsert({
  where: {
    empCode_punchTime: {
      empCode: transaction.emp_code,
      punchTime: new Date(transaction.punch_time),
    },
  },
  create: { /* map fields */ },
  update: {}, // no-op if already exists
});
```

---

## What AMS should NOT do

| Avoid | Why |
|-------|-----|
| Push employees without `departments` + `department_name` | Employees get invalid dept IDs; ZKTime UI may hide them |
| Use AMS `department_id` as ZKTime `DEPTID` directly | IDs differ; bridge maps them |
| Set `since` to `now()` on attendance pull | Excludes all existing punches |
| Call device sync twice in one flow | Bridge deduplicates; redundant calls are no-ops |
| Assume `pushed` count means device downloads | Check `queuedForDevice` instead |

---

## Environment variables (AMS / Vercel)

```env
ZKTIME_BASE_URL=https://lahore-server.tailca4ca9.ts.net
ZKTIME_API_KEY=<same as bridge server .env>
AMS_CRON_SECRET=<cron auth secret>
ZKTIME_DEFAULT_SYNC_SINCE=2000-01-01 00:00:00
```

---

## Cron recommendations

| Job | Schedule | Endpoint |
|-----|----------|----------|
| Pull attendance | Every 5–10 min | `GET /api/sync/attendance?since=<last latestUploadTime>` |
| Pull employees | Daily (optional) | `GET /api/sync/employees` |
| Push new/changed hires | On demand or hourly | `POST /api/sync/employees` |

Full employee push is safe to run repeatedly — the bridge skips unchanged records.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `queuedForDevice: 0` but employees new | Data unchanged or `queue_to_device: false` | Check `sync_action` per employee |
| Employees in DB but not in ZKTime UI | Invalid/missing department | Include `departments` array with names |
| Attendance pull returns 0 | `since` too recent or timezone mismatch | Reset `since` to `2000-01-01 00:00:00` once |
| Duplicate attendance in AMS | No upsert on save | Add unique constraint on `(emp_code, punch_time)` |
| `skipped_unchanged: 0` on re-push | Name/dept differs from ZKTime | Compare `full_name` and `department_name` exactly |

---

## Bridge logs (server)

Logs are written to `logs/bridge.txt` on the Lahore server. Each sync logs `sync_action` and `queued` per employee.

```powershell
cd C:\Users\Administrator\xorora-zktime-bridge
.\server-scripts\tail-logs.ps1
```

Look for lines like:

```
Employee sync badge=011 action=unchanged queued=False
Employee sync badge=002 action=updated queued=True
Master data sync complete departments=8 employees=22 queued=1 skipped=21
```

---

## Quick reference

| Direction | Dedup where? | Key |
|-----------|--------------|-----|
| Push departments | Bridge | `department.name` |
| Push employees (DB) | Bridge | `emp_code` |
| Push employees (device) | Bridge | unchanged + linked → skip queue |
| Pull attendance | **AMS** (on save) | `emp_code` + `punch_time` |
