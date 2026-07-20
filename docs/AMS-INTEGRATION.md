# Xorora Punch ↔ ZKTime Integration

Xorora Punch connects to K40 biometric devices through the ZKTime bridge API.

## Data flow

| Direction | Xorora Punch route | Bridge endpoint | ZKTime table |
|-----------|-----------|-----------------|--------------|
| Pull attendance | `GET /api/sync/attendance` | `GET /api/v1/transactions/export` | `CHECKINOUT` |
| Pull employees | `GET /api/sync/employees` | `GET /api/v1/employees` | `USERINFO` |
| Push employees | `POST /api/sync/employees` | `POST /api/v1/sync/master-data` | `USERINFO`, `UsersMachines`, `UserUpdates` |

Join key in Xorora Punch: **`emp_code`** ↔ ZKTime **`Badgenumber`**.

## Vercel environment

```env
ZKTIME_BASE_URL=https://lahore-server.tailca4ca9.ts.net
ZKTIME_API_KEY=<bridge API key from server .env>
CRON_SECRET=<random secret for cron auth>
ZKTIME_DEFAULT_COMPANY_SLUG=xorora
ZKTIME_TIMEZONE=Asia/Karachi
```

First attendance sync (no stored cursor) uses **today at 00:00:00** in `ZKTIME_TIMEZONE`. Later runs use **`next_since`** from the previous sync response, stored in Xorora Punch `sync_state` (`zktime_last_attendance_next_since`).

## Cron jobs

### Pull attendance every 5 minutes

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://Xorora Punch.xorora.com/api/sync/attendance?since=2026-06-29%2000:00:00"
```

Store **`next_since`** from the response and pass it as `since` on the next run.

### Pull employees daily

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://Xorora Punch.xorora.com/api/sync/employees"
```

### Push new or changed Xorora Punch hires to device (compares with ZKTime first; only sends deltas):

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"departments":[{"id":1,"name":"Xorora - Engineering"}],"employees":[{"emp_code":"1001","full_name":"Ali Khan","department_id":1,"department_name":"Xorora - Engineering"}],"queue_to_device":true}' \
  "https://Xorora Punch.xorora.com/api/sync/employees"
```

Force a full push of every active employee (ignore ZKTime comparison):

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"pushAll": true}' \
  "https://Xorora Punch.xorora.com/api/sync/employees"
```

Incremental push of all active employees with changes only (empty body):

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://Xorora Punch.xorora.com/api/sync/employees"
```

ZKTime `Att.exe` picks up `UserUpdates` and syncs users to the K40.

## Direct bridge API (debug)

```powershell
$headers = @{ Authorization = "Bearer <ZKTIME_API_KEY>" }
Invoke-RestMethod https://lahore-server.tailca4ca9.ts.net/api/v1/health
Invoke-RestMethod https://lahore-server.tailca4ca9.ts.net/api/v1/terminals -Headers $headers
```

Interactive docs: `https://lahore-server.tailca4ca9.ts.net/docs`

## Notes

- Only one app can use TCP 4370 on the K40. Keep ZKTime running on the office server.
- The bridge listens on **port 8090** — run `setup-tailscale-funnel.ps1` to expose it via Tailscale.
- Attendance appears in Xorora Punch only after employees exist in ZKTime with matching badge numbers.
- `GET /api/sync/attendance` upserts punches into Xorora Punch (deduped on `emp_code` + `punch_time`) and returns **`next_since`** for the next cron run.
- `GET /api/sync/employees` upserts employees into Xorora Punch and returns a summary list from ZKTime.
