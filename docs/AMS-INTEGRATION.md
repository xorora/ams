# AMS ↔ ZKTime Integration

Use this bridge when ZKTime (not WDMS) owns the K40 device connection.

## Data flow

| Direction | AMS route | Bridge endpoint | ZKTime table |
|-----------|-----------|-----------------|--------------|
| Pull attendance | `GET /api/sync/attendance` | `GET /api/v1/transactions/export` | `CHECKINOUT` |
| Pull employees | `GET /api/sync/employees` | `GET /api/v1/employees` | `USERINFO` |
| Push employees | `POST /api/sync/employees` | `POST /api/v1/employees` | `USERINFO`, `UsersMachines`, `UserUpdates` |

Join key in AMS: **`emp_code`** ↔ ZKTime **`Badgenumber`**.

## Vercel environment

```env
ZKTIME_BASE_URL=https://lahore-server.tailca4ca9.ts.net
ZKTIME_API_KEY=<bridge API key from server .env>
CRON_SECRET=<random secret for cron auth>
ZKTIME_DEFAULT_SYNC_SINCE=2000-01-01 00:00:00
```

Remove or disable WDMS vars if fully switching:

```env
# WDMS_BASE_URL=...
# WDMS_USERNAME=...
# WDMS_PASSWORD=...
```

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

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"employees":[{"emp_code":"1001","full_name":"Ali Khan","department_id":1}]}' \
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

- Only one app can use TCP 4370 on the K40. Keep ZKTime running; do not run WDMS device sync at the same time.
- IIS on port 80 broke the old WDMS funnel. This bridge uses **port 8090** — run `setup-tailscale-funnel.ps1` to repoint Tailscale.
- Attendance appears in AMS only after employees exist in ZKTime with matching badge numbers.
- Implement Prisma upsert TODOs in the AMS sync routes for production reconciliation.
