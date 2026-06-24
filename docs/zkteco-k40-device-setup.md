# ZKTeco K40 — Cloud Server Setup (ADMS Direct)

Configure the K40 to push attendance and pull employee updates directly to AMS over HTTPS. No LAN sync agent, ngrok, or ZKBio Time server required.

| Direction | What syncs | How |
|-----------|-----------|-----|
| Device → AMS | Attendance punches | K40 pushes ATTLOG on each scan (~1–5 s) |
| AMS → Device | Employee profiles | AMS queues ADMS commands; K40 pulls every heartbeat (~5 s) |
| Device → AMS | Existing employees (bootstrap) | AMS sends `QUERY USERINFO`; device uploads user records |

**Production AMS URL:** `https://ams.xorora.com`

The device calls these paths (hardcoded by firmware — not under `/api/`):

- `GET/POST https://ams.xorora.com/iclock/cdata?SN=…`
- `GET https://ams.xorora.com/iclock/getrequest?SN=…`
- `POST https://ams.xorora.com/iclock/devicecmd?SN=…`

---

## Prerequisites

1. AMS deployed with `/iclock/*` routes and ZKTeco env vars set on Vercel
2. Database migration `0014_misty_wraith` applied (`bun run db:migrate`)
3. Device can reach the public internet on outbound **HTTPS (443)**
4. Device date/time correct (enable NTP; timezone UTC+5 / Asia/Karachi)

### AMS environment variables (Vercel + local)

Add to [`.env.example`](../.env.example) / Vercel Production:

```env
ZKTECO_TIMEZONE=Asia/Karachi
ZKTECO_DEVICE_TOKEN=<shared-stamp-secret>
ZKTECO_DEFAULT_COMPANY_SLUG=xorora
```

Set `ZKTECO_SYNC_ALL_COMPANIES=true` when the K40 should receive **every** active AMS company and all of their employees (recommended for shared office devices):

```env
ZKTECO_SYNC_ALL_COMPANIES=true
```

When unset or not `true`, only employees from `ZKTECO_DEFAULT_COMPANY_SLUG` are pushed.

Optional device status thresholds (seconds):

```env
ZKTECO_DEVICE_ONLINE_THRESHOLD_SECONDS=180
ZKTECO_DEVICE_STALE_THRESHOLD_SECONDS=900
```

Generate the shared secret once:

```bash
openssl rand -base64 32
```

Use the **same value** in Vercel and on the device **Stamp** field (also labelled **Server Auth Key** or **Device Token** on some firmware).

Do **not** put the device serial number in env — AMS auto-registers devices by `SN` on first handshake.

### JWT username/password — not used (ADMS Direct)

ZKBio Time docs at `172.16.10.104` describe **two different APIs**:

| API | Auth | Who calls it |
|-----|------|--------------|
| `/iclock/cdata`, `/iclock/getrequest` (ADMS) | Device **SN** + **Stamp** (`ZKTECO_DEVICE_TOKEN`) | K40 firmware → AMS |
| `/personnel/api/*`, `/iclock/api/*` (REST) | **JWT** from `POST /jwt-api-token-auth/` | Your server → ZKBio Time on LAN |

AMS uses **ADMS Direct**: the K40 points at `ams.xorora.com` and polls with Stamp. **No `ZKBIO_USERNAME` / `ZKBIO_PASSWORD` needed** — and Vercel cannot reach `172.16.10.104` on your LAN anyway.

If sync commands are not appearing on the device, the usual causes are:

1. K40 cloud server not pointing at `ams.xorora.com` (still on ZKBio `172.16.10.104`)
2. Stamp on device ≠ `ZKTECO_DEVICE_TOKEN` on Vercel
3. Device offline (no heartbeat) — check **Last seen** on admin devices page
4. Commands stuck as `sent` — run **Sync** after deploying the getrequest probe fix (re-queues stale commands)

---

## Registered device

| Item | Value |
|------|-------|
| Serial number (SN) | `PAS4261300498` |
| Production server | `ams.xorora.com` |
| Port | `443` |
| HTTPS | ON |

---

## K40 menu configuration

Path varies by firmware; typically **Menu → COMM. → Cloud Server Setting** (or **ADMS** / **WiFi/Network → Cloud Server**).

| Setting | Value | Notes |
|---------|-------|-------|
| ADMS / Cloud Server | **Enabled** | Must be ON |
| Enable Domain Name | **ON** | Required for hostname (not raw IP) |
| Server Address | `ams.xorora.com` | No `https://` prefix |
| Server Port | `443` | |
| HTTPS | **ON** | Required for Vercel |
| Enable Proxy Server | **OFF** | Unless your network requires a proxy |
| Stamp / Server Auth Key | Same as `ZKTECO_DEVICE_TOKEN` | Must match Vercel exactly |
| Server Mode | **ADMS** | Not "Standalone" |

Save and reboot the device if prompted.

### Disconnect from ZKBio Time

The K40 can push to **one** ADMS server only. If it currently points at `172.16.10.104` (ZKBio Time), repoint it to `ams.xorora.com`. ZKBio will stop receiving punches from this device — that is expected after cutover.

### Date & time

**Menu → System → Date/Time**

- Enable NTP (e.g. `pool.ntp.org`) or set correct local time
- Timezone: Pakistan (UTC+5)
- Wrong clock is the most common cause of punches on the wrong shift date

---

## Verification

### 1. Deploy check (production)

Before configuring the device, confirm AMS serves ADMS routes:

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  "https://ams.xorora.com/iclock/cdata?SN=PAS4261300498&options=all"
```

| HTTP code | Meaning |
|-----------|---------|
| **200** + plain-text handshake body | Routes live — proceed with device config |
| **404** | ZKTeco routes not deployed yet — deploy AMS first |
| **403** `Not Authorized Terminal` | Routes live but Stamp/token mismatch or invalid SN |

Expected handshake body (200):

```
GET OPTION FROM: PAS4261300498
ATTLOGStamp=0
...
Realtime=1
ServerVer=3.0.1
```

### 2. Automated verification script

From the repo root (uses `.env.local` or env vars):

```bash
# Local dev server (bun run dev)
./scripts/zkteco-verify-device.sh

# Production
./scripts/zkteco-verify-device.sh --production
```

The script runs:

1. **Handshake** — `GET /iclock/cdata?SN=…&options=all`
2. **Heartbeat** — `GET /iclock/getrequest?SN=…`
3. **Test punch** — `POST /iclock/cdata?table=ATTLOG` with a synthetic scan line

All three should return HTTP 200. The test punch inserts a row into `machine_punches` with `source_system = zkteco`.

### 3. Device online (after physical config)

Within **60 seconds** of saving cloud server settings, the device should appear in the database:

```sql
SELECT serial_number, last_seen_at, firmware_version
FROM zkteco_devices
WHERE serial_number = 'PAS4261300498';
```

A device is considered **online** when `last_seen_at` is within the last **3 minutes** (configurable). **Idle** means seen within 15 minutes. The admin devices page auto-refreshes every 30 seconds.

Verify scripts use `probe=1` so they do not fake a device heartbeat.

Admins can also check via API (requires admin session):

```
GET /api/admin/zkteco/devices
```

### 4. Live punch test (on device)

1. Scan a fingerprint or card on the K40
2. Within **1–10 seconds**, confirm a new row:

```sql
SELECT card_no, punch_at, machine_no, source_system
FROM machine_punches
WHERE source_system = 'zkteco'
ORDER BY punch_at DESC
LIMIT 5;
```

3. If the PIN matches an AMS `employees.employee_code` (or `machine_card_no` / biometric mapping), `employee_id` is set and `attendance_days` is updated automatically

### 5. Employee push test (optional)

1. Create or update an employee in **Admin → Employees**
2. Within **5–15 seconds**, the device should receive an `UPDATE USERINFO` command on its next heartbeat
3. Confirm the user appears on the K40 user list

---

## Initial device setup (companies → employees → biometrics)

Do this once after pointing the K40 at AMS. Ebio should already be stopped.

### ZKBio Time API vs AMS ADMS (what syncs)

ZKBio Time 8.0 at `172.16.10.104` documents two layers. AMS talks **ADMS directly** to the K40 (device points at `ams.xorora.com`, not ZKBio).

| ZKBio REST API (JWT) | AMS ADMS equivalent | Direction | Data |
|----------------------|---------------------|-----------|------|
| `GET /personnel/api/company/` | `QUERY DEPTINFO` / `UPDATE DEPTINFO` | ↔ | Companies + team departments on device |
| `GET /personnel/api/departments/` | `DEPTINFO` records | ↔ | Department names |
| `GET /personnel/api/employees/` | `QUERY USERINFO` / `UPDATE USERINFO` | ↔ | PIN, name, card, department |
| `POST …/employees/resync_to_device/` | `UPDATE USERINFO` queue | AMS → device | Push employee profiles |
| `POST /iclock/api/terminals/upload_all/` | `QUERY DEPTINFO` + `QUERY USERINFO` | device → AMS | Pull device state |
| `bio_template_api` / `del_bio_template` | — | — | **Not synced** — enroll fingerprints on device |

**One-click Sync** on **Admin → Biometric devices** queues, in order:

1. Pull departments from device (`QUERY DEPTINFO`)
2. Pull users from device (`QUERY USERINFO`) — links or creates AMS employees
3. Push all AMS departments (companies + teams) to device
4. Push all AMS employees (per company when `ZKTECO_SYNC_ALL_COMPANIES=true`)

The device processes **one command per heartbeat (~5 s)**. A full sync of 2 companies + 22 employees takes ~2–3 minutes.

**Biometrics (fingerprints)** are never transferred over ADMS — enroll on the K40 after profiles sync.

### Step 1 — Enable all companies on AMS

On **Vercel Production** (and `.env.local` for local scripts):

```env
ZKTECO_SYNC_ALL_COMPANIES=true
```

Redeploy after changing Vercel env vars.

Current AMS companies that will sync to the device:

| Company | Active employees |
|---------|------------------|
| Crest LED | 13 |
| Xorora | 9 |

Companies are pushed as **departments** (`DEPTINFO`) on the K40. Employee records reference each person’s AMS `department` field (Xorora teams like IT, Engineering; Crest LED employees may have no department).

### Step 2 — Sync (one button)

**Admin UI:** [Biometric devices](/admin/devices) → device `PAS4261300498` → **Sync**

This pulls device state, then pushes AMS as the source of truth for companies and employees.

**CLI alternative:**

```bash
bun --env-file=.env.local scripts/zkteco-push-device.ts PAS4261300498 sync
```

Advanced options (More menu): push companies only, push employees only, or pull only.

### Step 3 — Enroll biometrics on the K40 (physical)

AMS pushes **user profiles** (PIN, name, card number) only — **fingerprints are enrolled on the device**, not in AMS.

For each employee:

1. **Menu → User Mgt → User** (or **Personnel** — varies by firmware)
2. Find the user by **PIN** (matches AMS `employee_code`, e.g. `001`, `011`)
3. Select **Enroll fingerprint** (or **FP**)
4. Scan the same finger **2–3 times** until enrollment succeeds
5. Repeat for every employee who will use this device

Tips:

- PIN on device must match `employees.employee_code` in AMS
- Enroll after the push completes — user must exist on device first
- Card-only users can skip FP if they use RFID cards already assigned in AMS (`machine_card_no`)

### Step 4 — Verify attendance

1. Scan an enrolled employee on the K40
2. Within ~10 s, check **Admin → Attendance** for today’s check-in
3. Run `./scripts/zkteco-verify-device.sh --production` for ADMS connectivity checks

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Device shows offline / connection error | Routes not deployed or wrong server address | Deploy AMS; verify `ams.xorora.com:443` |
| HTTP 403 on handshake | Stamp mismatch | Match K40 Stamp to `ZKTECO_DEVICE_TOKEN` exactly |
| HTTP 403 on handshake | Invalid SN format | SN must be 4–64 alphanumeric chars |
| Punches missing or wrong date | Device clock wrong | Enable NTP; set Asia/Karachi |
| Punches in DB but no employee link | PIN not mapped | Match device PIN to `employee_code`; run bootstrap sync |
| Employee not on device | Command queue / offline device | Confirm device online; check `zkteco_device_commands` |

### Vercel logs

After deployment, filter logs for:

```
GET /iclock/cdata?SN=PAS4261300498
GET /iclock/getrequest?SN=PAS4261300498
POST /iclock/cdata?SN=PAS4261300498&table=ATTLOG
```

Regular heartbeat traffic every ~5 s confirms the device is connected.

---

## Security notes

ADMS endpoints are unauthenticated by protocol design. AMS secures them via:

- Device serial number (`SN`) validation
- Optional shared secret in the Stamp / `pushcommkey` query param (`ZKTECO_DEVICE_TOKEN`)
- SN-based registration (unknown devices auto-register but can be restricted later)

Do not expose ZKBio Time admin API publicly. Admin sync APIs require AMS admin auth.

---

## Related

- Ebio cutover (stop AMSBioSync, remove legacy env): [docs/ebio-cutover.md](../docs/ebio-cutover.md)
- AMS env template: [`.env.example`](../.env.example)
