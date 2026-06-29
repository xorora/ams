# AMS ↔ ZKBio WDMS Integration Guide

How to connect **ams.xorora.com** (Next.js) with **ZKBio WDMS** (biometric server) for push/pull data sync.

---

## 1. Architecture overview

```
┌─────────────┐   ADMS push (HTTP)    ┌──────────────────────────────────┐
│  K40 Device │ ────────────────────► │  ZKBio WDMS (lahore-server)      │
│  office LAN │   192.168.1.23:80     │  stores punches + employees      │
└─────────────┘                       └───────────────┬──────────────────┘
                                                      │
                              REST API (Token auth)   │
                                                      │
                      ┌───────────────────────────────┴──────────────────┐
                      │  Tailscale Funnel (public HTTPS)                 │
                      │  https://lahore-server.tailca4ca9.ts.net         │
                      └───────────────────────────────┬──────────────────┘
                                                      │
                      ┌───────────────────────────────┴──────────────────┐
                      │  AMS Next.js (ams.xorora.com on Vercel)            │
                      │  cron routes pull WDMS → upsert AMS database       │
                      └──────────────────────────────────────────────────┘
```

### Who talks to whom

| Direction | From | To | Protocol | Purpose |
|-----------|------|----|----------|---------|
| **Device push** | K40 | WDMS | ADMS over HTTP | Biometric punches land in WDMS |
| **Pull** | AMS | WDMS | REST API | Fetch attendance + employees |
| **Push** | AMS | WDMS | REST API | Create/update employees on devices |
| **No direct link** | K40 | AMS | — | K40 never talks to AMS directly |

WDMS is the **source of truth** for raw biometric punches. AMS is the **source of truth** for HR workflows (hiring, leave, payroll rules).

---

## 2. Prerequisites

### On the WDMS server

- [x] ZKBio WDMS running (`bio-apache0` service)
- [x] Tailscale Funnel active at `https://lahore-server.tailca4ca9.ts.net`
- [ ] Dedicated API user created in WDMS (not full admin)

### In WDMS admin

1. Open `https://lahore-server.tailca4ca9.ts.net` (or LAN `http://192.168.1.23`)
2. Go to **System → User**
3. Create user e.g. `ams_api` with **OpenAPI / API** permissions only
4. Save username + password for AMS env vars

### On AMS (Vercel)

Add environment variables:

```env
WDMS_BASE_URL=https://lahore-server.tailca4ca9.ts.net
WDMS_USERNAME=ams_api
WDMS_PASSWORD=your_secure_password
AMS_CRON_SECRET=generate_a_long_random_string
```

### K40 device (office LAN)

| Setting | Value |
|---------|-------|
| Server Address | `192.168.1.23` |
| Server Port | `80` |
| Enable Domain Name | OFF (use IP) |
| HTTPS | OFF |

---

## 3. Authentication

Every AMS → WDMS API call uses **Token authentication**.

### Step 1 — Get token

```http
POST https://lahore-server.tailca4ca9.ts.net/api-token-auth/
Content-Type: application/json

{
  "username": "ams_api",
  "password": "your_password"
}
```

**Response:**

```json
{ "token": "dae1f6bd2*******************b0ce213f394" }
```

### Step 2 — Use token on all requests

```http
GET https://lahore-server.tailca4ca9.ts.net/iclock/api/transactions/?page=1&page_size=100
Content-Type: application/json
Authorization: Token dae1f6bd2*******************b0ce213f394
```

> JWT auth (`/jwt-api-token-auth/`) is also available but the bridge client uses the general token endpoint.

### Token lifecycle in code

The `WdmsClient` class (in `src/wdms-client.ts`) handles this automatically:

- Caches the token in memory
- Retries once on `401` with a fresh token
- Safe to reuse across requests in the same serverless invocation

---

## 4. Data flows — pull vs push

### Pull (WDMS → AMS) — primary sync pattern

| Data | WDMS endpoint | AMS action | Join key |
|------|---------------|------------|----------|
| Attendance punches | `GET /iclock/api/transactions/` | Insert/update attendance records | `emp_code` + `punch_time` |
| Employees | `GET /personnel/api/employees/` | Upsert employee profiles | `emp_code` |
| Device status | `GET /iclock/api/terminals/` | Monitor device health | `terminal_sn` |

### Push (AMS → WDMS) — when hiring or updating staff

| Data | WDMS endpoint | When to use |
|------|---------------|-------------|
| New employee | `POST /personnel/api/employees/` | New hire in AMS → push to WDMS → syncs to K40 |
| Department | `GET/POST /personnel/api/departments/` | Align org structure first |
| Resignation | Resign API | Employee leaves |

After pushing an employee to WDMS, WDMS automatically distributes them to enrolled biometric devices.

---

## 5. Pull attendance (transactions)

### Endpoint

```
GET /iclock/api/transactions/
```

### Key query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number (required) |
| `page_size` | int | Records per page (default 10, use 100–500) |
| `upload_time_more_than` | string | **Incremental sync cursor** — `YYYY-MM-DD HH:MM:SS` |
| `start_time` / `end_time` | string | Filter by punch time |
| `emp_code` | string | Filter by employee |
| `terminal_sn` | string | Filter by device serial |
| `ordering` | string | `upload_time` or `id` |

### Example — incremental pull

```http
GET /iclock/api/transactions/?page=1&page_size=500&upload_time_more_than=2026-06-29%2000:00:00&ordering=upload_time
Authorization: Token <token>
```

### Response shape

```json
{
  "count": 42,
  "next": "https://.../iclock/api/transactions/?page=2&...",
  "previous": null,
  "msg": "",
  "code": 0,
  "data": [
    {
      "id": 1,
      "emp_code": "1001",
      "first_name": "Ali",
      "last_name": "Khan",
      "department": "Engineering",
      "punch_time": "2026-06-29 09:02:15",
      "punch_state": "0",
      "punch_state_display": "Check In",
      "verify_type_display": "Fingerprint",
      "terminal_sn": "CGFD192960001",
      "terminal_alias": "Main Gate",
      "upload_time": "2026-06-29 09:02:18"
    }
  ]
}
```

### Pagination

Loop until `next` is `null`:

```typescript
const client = new WdmsClient({ baseUrl, username, password });
const punches = await client.getAllTransactionsSince("2026-06-29 00:00:00");
```

### AMS upsert logic (implement in your route)

```typescript
for (const tx of punches) {
  await db.attendance.upsert({
    where: {
      emp_code_punch_time: {
        emp_code: tx.emp_code,
        punch_time: new Date(tx.punch_time),
      },
    },
    create: {
      emp_code: tx.emp_code,
      punch_time: new Date(tx.punch_time),
      punch_state: tx.punch_state_display,
      verify_type: tx.verify_type_display,
      terminal_sn: tx.terminal_sn,
      wdms_id: tx.id,
      source: "wdms",
    },
    update: {
      punch_state: tx.punch_state_display,
      terminal_sn: tx.terminal_sn,
    },
  });
}
```

### Sync cursor — store this in AMS database

```sql
-- Example sync_state table
CREATE TABLE wdms_sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- After each successful attendance sync:
-- key = 'last_attendance_upload_time'
-- value = latest transaction.upload_time from the batch
```

Use `upload_time` (not `punch_time`) as the cursor — it reflects when WDMS received the record from the device.

---

## 6. Pull employees

### Endpoint

```
GET /personnel/api/employees/
```

### Key query parameters

| Parameter | Description |
|-----------|-------------|
| `page`, `page_size` | Pagination |
| `emp_code` | Exact match |
| `status` | `0` = active, `100` = resigned |
| `departments` | Filter by department ID |
| `ordering` | `emp_code`, `id`, etc. |

### Example

```typescript
const employees = await client.getAllEmployees(500);

for (const emp of employees) {
  await db.employee.upsert({
    where: { emp_code: emp.emp_code },
    create: {
      emp_code: emp.emp_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department?.dept_name ?? null,
      wdms_id: emp.id,
      status: emp.app_status === 0 ? "active" : "inactive",
    },
    update: {
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department?.dept_name ?? null,
    },
  });
}
```

### Recommended schedule

| Sync | Frequency | Route |
|------|-----------|-------|
| Attendance | Every 5–10 minutes | `GET /api/sync/attendance` |
| Employees | Daily at 2 AM | `GET /api/sync/employees` |
| Device health | Hourly (optional) | custom route |

---

## 7. Push employees (AMS → WDMS)

When a new employee is created in AMS, push them to WDMS so they appear on K40 devices.

### Endpoint

```
POST /personnel/api/employees/
Authorization: Token <token>
Content-Type: application/json
```

### Example payload

```json
{
  "emp_code": "1042",
  "first_name": "Sara",
  "last_name": "Ahmed",
  "department": 1,
  "hire_date": "2026-06-29"
}
```

### In AMS — call from your hire workflow

```typescript
// app/api/employees/hire/route.ts
import { WdmsClient } from "@/lib/wdms-client";

export async function POST(request: Request) {
  const { emp_code, first_name, last_name, department_id } = await request.json();

  // 1. Save to AMS database
  const employee = await db.employee.create({ data: { emp_code, first_name, last_name } });

  // 2. Push to WDMS (syncs to biometric devices)
  const wdms = new WdmsClient({
    baseUrl: process.env.WDMS_BASE_URL!,
    username: process.env.WDMS_USERNAME!,
    password: process.env.WDMS_PASSWORD!,
  });

  await wdms.createEmployee({
    emp_code,
    first_name,
    last_name,
    department: department_id,
    hire_date: new Date().toISOString().slice(0, 10),
  });

  return Response.json({ employee, wdms_synced: true });
}
```

> Map AMS department IDs to WDMS department IDs. Pull departments first via `GET /personnel/api/departments/` and maintain a mapping table.

---

## 8. Device monitoring (optional)

```typescript
const terminals = await client.getTerminals();

for (const device of terminals.data) {
  console.log(device.sn, device.alias, device.state, device.last_activity);
}
```

Use this to alert when a K40 goes offline.

---

## 9. Next.js integration — step by step

### Step 1 — Copy bridge files into AMS repo

```
your-ams-repo/
├── lib/
│   ├── wdms-client.ts      ← from xorora-wdms-bridge/src/
│   └── wdms-types.ts       ← from xorora-wdms-bridge/src/types.ts
└── app/api/sync/
    ├── attendance/route.ts ← from xorora-wdms-bridge/nextjs/
    └── employees/route.ts
```

### Step 2 — Add env vars in Vercel

| Variable | Value |
|----------|-------|
| `WDMS_BASE_URL` | `https://lahore-server.tailca4ca9.ts.net` |
| `WDMS_USERNAME` | `ams_api` |
| `WDMS_PASSWORD` | (secret) |
| `AMS_CRON_SECRET` | (random 32+ char string) |

### Step 3 — Add Vercel cron (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/sync/attendance",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/sync/employees",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Step 4 — Protect cron routes

Cron routes require:

```http
Authorization: Bearer <AMS_CRON_SECRET>
```

Vercel Cron sends this automatically if you configure `CRON_SECRET` — or call manually:

```bash
curl -H "Authorization: Bearer $AMS_CRON_SECRET" \
  "https://ams.xorora.com/api/sync/attendance"
```

### Step 5 — Implement database upserts

Replace the `// TODO` sections in the route files with your Prisma/Drizzle/SQL logic.

### Step 6 — Store sync cursor in database (not a file)

On Vercel serverless, **do not use `.last-sync.json`** (ephemeral filesystem). Use your database:

```typescript
async function getLastSyncTime(): Promise<string> {
  const row = await db.wdmsSyncState.findUnique({
    where: { key: "last_attendance_upload_time" },
  });
  return row?.value ?? "2000-01-01 00:00:00";
}

async function setLastSyncTime(value: string): Promise<void> {
  await db.wdmsSyncState.upsert({
    where: { key: "last_attendance_upload_time" },
    create: { key: "last_attendance_upload_time", value },
    update: { value },
  });
}
```

---

## 10. Reconciliation rules

### Join key: `emp_code`

Both systems must use the **same employee code**. When creating employees in AMS, set `emp_code` to match what will be enrolled on the K40 (or let AMS generate and push to WDMS).

### Idempotency

| Record | Unique constraint | Why |
|--------|-------------------|-----|
| Attendance | `emp_code` + `punch_time` | Same punch may be re-fetched |
| Employee | `emp_code` | WDMS is master for device enrollment |
| WDMS transaction ID | `wdms_id` | Extra dedup safety |

### Conflict resolution

| Scenario | Rule |
|----------|------|
| Employee exists in WDMS but not AMS | Pull creates them in AMS |
| Employee exists in AMS but not WDMS | Push to WDMS on hire event |
| Employee resigned in AMS | Call WDMS resign API |
| Duplicate punch | Skip (upsert on unique key) |
| Clock drift on device | Trust `punch_time` from device, not `upload_time` for display |

### What NOT to sync

- Raw fingerprint/face templates (stay on WDMS/devices)
- WDMS admin users
- AMS leave/payroll data → WDMS (WDMS is attendance-only)

---

## 11. Example: full attendance sync route

```typescript
// app/api/sync/attendance/route.ts
import { NextResponse } from "next/server";
import { WdmsClient } from "@/lib/wdms-client";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro: allow up to 60s

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.AMS_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = new WdmsClient({
    baseUrl: process.env.WDMS_BASE_URL!,
    username: process.env.WDMS_USERNAME!,
    password: process.env.WDMS_PASSWORD!,
  });

  const state = await db.wdmsSyncState.findUnique({
    where: { key: "last_attendance_upload_time" },
  });
  const since = state?.value ?? "2000-01-01 00:00:00";

  const transactions = await client.getAllTransactionsSince(since);
  let upserted = 0;

  for (const tx of transactions) {
    await db.attendance.upsert({
      where: {
        emp_code_punch_time: {
          emp_code: tx.emp_code,
          punch_time: new Date(tx.punch_time),
        },
      },
      create: {
        emp_code: tx.emp_code,
        punch_time: new Date(tx.punch_time),
        punch_state: tx.punch_state_display,
        verify_type: tx.verify_type_display,
        terminal_sn: tx.terminal_sn,
        wdms_id: tx.id,
      },
      update: {},
    });
    upserted++;
  }

  if (transactions.length > 0) {
    const latest = transactions.at(-1)!.upload_time;
    await db.wdmsSyncState.upsert({
      where: { key: "last_attendance_upload_time" },
      create: { key: "last_attendance_upload_time", value: latest },
      update: { value: latest },
    });
  }

  return NextResponse.json({ upserted, since, latest: transactions.at(-1)?.upload_time });
}
```

---

## 12. Testing checklist

### From WDMS server

```powershell
& 'C:\Users\Administrator\xorora-wdms-bridge\server-scripts\test-wdms-api.ps1' `
  -BaseUrl 'https://lahore-server.tailca4ca9.ts.net'
```

### From AMS (local dev)

```bash
# Test auth + pull
npm run test:connection   # in xorora-wdms-bridge/

# Test cron route locally
curl -H "Authorization: Bearer $AMS_CRON_SECRET" \
  http://localhost:3000/api/sync/attendance
```

### End-to-end test

1. Enroll a test employee on K40 (or punch with existing employee)
2. Wait 1–2 minutes for ADMS push to WDMS
3. Trigger `/api/sync/attendance` cron
4. Verify punch appears in AMS database
5. Verify it shows in AMS UI

---

## 13. Error handling

| HTTP code | Meaning | Action |
|-----------|---------|--------|
| `401` | Token expired | `WdmsClient` auto-retries; check credentials if persistent |
| `400` | Bad request / host issue | Check `WDMS_BASE_URL` is the Tailscale Funnel URL |
| `403` | API user lacks permission | Grant OpenAPI permissions in WDMS admin |
| `500` | WDMS server error | Check `bio-apache0` service on lahore-server |
| `timeout` | Funnel or WDMS slow | Increase `maxDuration`; reduce `page_size` |

### Retry strategy for cron

```typescript
// Vercel cron: if sync fails, cursor is NOT advanced — next run retries safely
// because upload_time_more_than uses the last successful cursor
```

---

## 14. API reference (quick)

| Method | Path | Direction |
|--------|------|-----------|
| `POST` | `/api-token-auth/` | Auth |
| `GET` | `/iclock/api/transactions/` | Pull punches |
| `GET` | `/personnel/api/employees/` | Pull employees |
| `POST` | `/personnel/api/employees/` | Push employee |
| `GET` | `/personnel/api/departments/` | Pull departments |
| `GET` | `/iclock/api/terminals/` | Device status |
| `GET` | `/iclock/cdata` | ADMS device endpoint (K40 only) |

**Interactive docs:** https://lahore-server.tailca4ca9.ts.net/docs/api-docs/

---

## 15. Package reference

Pre-built client and routes live at:

```
C:\Users\Administrator\xorora-wdms-bridge\
├── src/wdms-client.ts          # TypeScript API client
├── src/types.ts                # Response types
├── nextjs/app/api/sync/        # Drop-in Next.js routes
├── scripts/sync-attendance.ts  # Standalone sync script
└── .env.example                # Environment template
```

---

## 16. Summary

| Task | How |
|------|-----|
| K40 sends punches | ADMS push → WDMS (automatic, no AMS code) |
| AMS gets new punches | Cron pulls `GET /iclock/api/transactions/` every 10 min |
| AMS gets employee list | Cron pulls `GET /personnel/api/employees/` daily |
| AMS hires someone | `POST /personnel/api/employees/` on hire event |
| Connect AMS to WDMS | `WDMS_BASE_URL=https://lahore-server.tailca4ca9.ts.net` |
| Join employees | `emp_code` must match in both systems |
