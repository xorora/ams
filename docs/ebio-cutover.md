# Ebio → ZKTeco ADMS cutover

AMS previously synced biometric punches from **AttendanceTracker 11.8 (Ebio)** via a Windows service (`AMSBioSync`) that read `attendance_db.mdb` and pushed rows to Neon. That path is **retired** — the K40 now pushes punches and pulls employee updates directly to AMS over HTTPS (ADMS).

Historical punches ingested by the old service remain in `machine_punches` with `source_system = 'ebio'`. New punches use `source_system = 'zkteco'`.

---

## Prerequisites (complete before decommissioning)

1. K40 cloud server points at AMS (`ams.xorora.com`, HTTPS, Stamp matches `ZKTECO_DEVICE_TOKEN`) — see [zkteco-k40-device-setup.md](./zkteco-k40-device-setup.md).
2. Device appears online in AMS and test punches arrive within ~10 seconds.
3. Employee bootstrap from device completed (`QUERY USERINFO` / admin sync).
4. AMS employee create/update flows enqueue device commands and users appear on the K40.
5. Run side-by-side for 2–3 days if you want extra confidence.

---

## Stop and remove AMSBioSync (Windows)

Run **PowerShell as Administrator** on the machine that hosted the sync service (the PC with `attendance_db.mdb`).

```powershell
# Stop the service
Stop-Service -Name AMSBioSync -Force -ErrorAction SilentlyContinue

# Remove the Windows service (requires pywin32 from the old install)
cd $env:ProgramData\AMSBioSync\app
py -m ebio_sync.service remove

# Optional: delete installed files, config, and logs
Remove-Item -Recurse -Force $env:ProgramData\AMSBioSync
```

If `ebio_sync.service remove` fails because Python deps were already removed, unregister via `sc.exe`:

```powershell
sc.exe delete AMSBioSync
```

Confirm the service is gone:

```powershell
Get-Service -Name AMSBioSync -ErrorAction SilentlyContinue
```

Should return nothing.

---

## Clean up AMS (Vercel / env)

After the Windows service is stopped:

| Item | Action |
|------|--------|
| `EBIO_UPDATE_TOKEN` | Remove from Vercel Production/Preview env if still set (legacy Ebio agent only) |
| `AttendanceTracker 11.8` | Can stay installed for local reports; AMS no longer reads `attendance_db.mdb` |

Redeploy AMS after removing unused legacy env vars.

---

## Verify cutover

| Check | Expected |
|-------|----------|
| `Get-Service AMSBioSync` on Windows | Service not found |
| K40 test punch | Appears in AMS admin attendance within ~10 s |
| Create employee in AMS | Appears on K40 within ~15 s |
| Vercel logs | `GET /iclock/cdata` and `GET /iclock/getrequest` from device SN |
| No new `source_system = 'ebio'` rows | Only historical rows remain |

---

## Recovering the old sync code

The Ebio sync agent (Windows service, `ebio_sync` Python package, and sync-agent API) was removed in the ADMS cutover. Restore from git history if needed:

```bash
git log --oneline -- scripts/ebio_sync/
git show <commit>:scripts/ebio_sync/service.py
```

---

## Related

- [ZKTeco K40 device setup](./zkteco-k40-device-setup.md)
- [README — ZKTeco env vars](../README.md#zkteco-k40-biometric-device)
