# AMS ↔ ZKTime Integration

AMS connects to K40 biometric devices through the ZKTime bridge API.

## Data flow

| Direction | AMS route | Bridge endpoint | ZKTime table |
|-----------|-----------|-----------------|--------------|
| Pull attendance | `GET /api/sync/attendance` | `GET /api/v1/transactions/export` | `CHECKINOUT` |
| Pull employees | `GET /api/sync/employees` | `GET /api/v1/employees` | `USERINFO` |
| Push employees | `POST /api/sync/employees` | `POST /api/v1/sync/master-data` | `USERINFO`, `UsersMachines`, `UserUpdates` |

Join key in AMS: **`emp_code`** ↔ ZKTime **`Badgenumber`**.

## Vercel environment

```env
ZKTIME_BASE_URL=https://lahore-server.tailca4ca9.ts.net
ZKTIME_API_KEY=<bridge API key from server .env>
CRON_SECRET=<random secret for cron auth>
ZKTIME_DEFAULT_COMPANY_SLUG=xorora
ZKTIME_TIMEZONE=Asia/Karachi
```

First attendance sync (no stored cursor) uses **today at 00:00:00** in `ZKTIME_TIMEZONE`. Later runs use `latestUploadTime` saved in AMS `sync_state`.

## Cron jobs

### Pull attendance every 5 minutes

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://ams.xorora.com/api/sync/attendance?since=2026-06-29%2000:00:00"
```

Store `latestUploadTime` from the response and pass it as `since` on the next run.

### Pull employees daily

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://ams.xorora.com/api/sync/employees"
```

### Push new AMS hires to device

Targeted push:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"departments":[{"id":1,"name":"Xorora - Engineering"}],"employees":[{"emp_code":"1001","full_name":"Ali Khan","department_id":1,"department_name":"Xorora - Engineering"}],"queue_to_device":true}' \
  "https://ams.xorora.com/api/sync/employees"
```

Push all active AMS employees (empty body or `{"pushAll": true}`):

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"pushAll": true}' \
  "https://ams.xorora.com/api/sync/employees"
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
- Attendance appears in AMS only after employees exist in ZKTime with matching badge numbers.
- `GET /api/sync/attendance` upserts punches into AMS and returns `latestUploadTime` for the next cron run.
- `GET /api/sync/employees` upserts employees into AMS and returns a summary list from ZKTime.
