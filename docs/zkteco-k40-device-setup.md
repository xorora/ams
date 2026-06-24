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

Generate the shared secret once:

```bash
openssl rand -base64 32
```

Use the **same value** in Vercel and on the device **Stamp** field (also labelled **Server Auth Key** or **Device Token** on some firmware).

Do **not** put the device serial number in env — AMS auto-registers devices by `SN` on first handshake.

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

A device is considered **online** when `last_seen_at` is within the last 60 seconds (updated on every heartbeat).

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
