# AMS — Attendance Management System

Employee attendance and leave for night-shift teams. Expected check-in **18:00**, check-out **03:00** the next morning, all in **Asia/Karachi (PKT)**. Built with Next.js 16, Neon PostgreSQL, and Auth.js (Google Workspace SSO).

## Features

### Authentication & onboarding

- **Google Workspace SSO** — domain-restricted sign-in via `GOOGLE_WORKSPACE_HD` (`hd` parameter + hosted-domain validation)
- **Employee linking** — admins pre-create records; employees confirm with an **employee code** at `/register` (auto-linked when email already matches)
- **Bootstrap admin** — first login with `BOOTSTRAP_ADMIN_EMAIL` receives the `admin` role when no admin exists yet
- **Route protection** — [`src/proxy.ts`](src/proxy.ts) guards pages and APIs; unlinked employees are redirected to registration

### Employee dashboard

- **Geofenced check-in/out** — browser location required; requests outside the office radius return **403**
- **Live shift status** — PKT clock, current shift date, work state (checked in, on break, checked out)
- **Break tracking** — start/end breaks with a **60-minute** cap per shift and remaining-time warnings
- **Late & early leave** — late if check-in after **18:30 PKT**; early leave if check-out before **03:00 PKT**
- **Early checkout confirmation** — prompt before checking out early
- **Weekend handling** — Saturday and Sunday shifts are treated as office-closed days (no check-in)
- **Deactivated account notice** — inactive employees see a clear message on the dashboard

### Leave management

- **Three leave types** — annual (14 days), casual (10 days), sick (8 days) per calendar year
- **Balance tracking** — entitled, used, pending, and remaining days per type
- **Annual leave** — working days only (Mon–Fri); **auto-approved** on submit
- **Casual & sick leave** — calendar days; require **admin approval**; sick leave requires a medical certificate note
- **Overlap & balance checks** — prevents double-booking and over-allocation
- **Attendance sync** — approved leave creates or updates attendance rows with status `leave`
- **Probation gate** — employees on probation cannot apply for leave until the period ends
- **Self-service cancel** — employees can cancel **pending** requests

### Admin

- **Employees** — CRUD with code, name, email, department; search and filter active/inactive
- **Probation** — enable on create, track start date and period (1–24 months, default 3), start/end actions, progress display
- **Attendance** — list, filter, create, edit, delete, and bulk status changes; manual corrections with audit fields
- **Leave requests** — review pending casual/sick requests; approve or reject with optional notes
- **Reports** — date-range summary and per-employee drill-down with present/absent/leave/late/early stats
- **Excel export** — summary and per-employee workbooks (`.xlsx`) via ExcelJS
- **Deactivation safety** — when deactivating an employee who is still checked in or on break, admin can confirm closing the open shift first

### Automation & UI

- **Cron job** — marks **absent** for active employees with no check-in on the completed shift date (skips weekends and existing leave/present records)
- **Dark mode** — system/light/dark theme toggle (next-themes)
- **Responsive shell** — collapsible sidebar navigation for authenticated users

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack dev) |
| Package manager | [Bun](https://bun.sh) |
| Lint / format | [Biome](https://biomejs.dev) |
| UI | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) |
| ORM | Drizzle ORM + `@neondatabase/serverless` |
| Auth | Auth.js v5 (`next-auth`) — Google provider |
| Jobs | Vercel Cron → `GET /api/cron/mark-absent` |
| Deploy | Vercel |

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- [Neon](https://neon.tech) PostgreSQL project
- Google Cloud OAuth client (Web) with redirect URIs for local and production
- Google Workspace domain matching `GOOGLE_WORKSPACE_HD`
- [Vercel](https://vercel.com) account (Cron requires a plan that supports scheduled functions)

## Setup guide

### 1. Clone and install

```bash
git clone <repository-url>
cd ams
bun install
```

### 2. Configure environment

Copy the template and fill in all required values:

```bash
cp .env.example .env.local
```

Generate an Auth.js secret:

```bash
openssl rand -base64 32
```

See [Environment variables](#environment-variables) and the provider sections below for each value.

### 3. Create the database schema

Push the Drizzle schema to your Neon database:

```bash
bun run db:push
```

For migration-based workflows instead of push:

```bash
bun run db:generate
bun run db:migrate
```

### 4. Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Configure the **OAuth consent screen** (Internal for a single Workspace org).
3. **Credentials → Create credentials → OAuth client ID → Web application**
4. **Authorized JavaScript origins**
   - `http://localhost:3000`
   - `https://<your-production-domain>`
5. **Authorized redirect URIs**
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-production-domain>/api/auth/callback/google`
6. Copy **Client ID** and **Client secret** into `.env.local`.
7. Set `GOOGLE_WORKSPACE_HD` to your Workspace primary domain (e.g. `acme.com`).

### 5. Set office geofence

Use real WGS84 coordinates for your office:

```env
OFFICE_LAT=24.8607
OFFICE_LNG=67.0011
OFFICE_RADIUS_METERS=100
```

On first geofenced action, AMS seeds a row in `office_settings` from these env vars. Later check-ins read from the database.

### 6. Bootstrap the first admin

Before anyone signs in, set your admin email:

```env
BOOTSTRAP_ADMIN_EMAIL=you@company.com
```

The first user to sign in with this email receives `role=admin`. Remove this variable after at least one admin exists.

### 7. Run locally

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and complete employee registration if prompted.

Server startup validates required auth and office env via [`src/instrumentation.ts`](src/instrumentation.ts).

### 8. Verify the setup

| Step | Action |
|------|--------|
| Sign-in | Use a Workspace account on your configured domain |
| Admin | Confirm `/admin/employees` loads after bootstrap login |
| Employee | Pre-create a record or self-register at `/register` with an employee code |
| Attendance | Check in from `/dashboard` while within the geofence |
| Leave | Apply for leave at `/leave` (after probation, if enabled) |

Optional: inspect data with `bun run db:studio`.

## Environment variables

Full template: [`.env.example`](./.env.example).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption (`openssl rand -base64 32`) |
| `AUTH_URL` | Yes (local) | App origin, e.g. `http://localhost:3000`; production uses your Vercel URL |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Web client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GOOGLE_WORKSPACE_HD` | Yes | Allowed Workspace domain (e.g. `company.com`); sign-in fails if unset |
| `OFFICE_LAT` | Yes | Office latitude (WGS84) for geofence |
| `OFFICE_LNG` | Yes | Office longitude (WGS84) for geofence |
| `OFFICE_RADIUS_METERS` | No | Geofence radius (default **100**) |
| `CRON_SECRET` | Prod | Bearer token for cron routes (mark-absent, ZKTime sync) |
| `BOOTSTRAP_ADMIN_EMAIL` | Once | First login with this email becomes `admin`; remove after bootstrap |
| `ZKTIME_BASE_URL` | Biometric | ZKTime bridge URL (e.g. `https://lahore-server.tailca4ca9.ts.net`) |
| `ZKTIME_API_KEY` | Biometric | Bridge API key from the ZKTime server |
| `ZKTIME_TIMEZONE` | No | Punch timezone (default: Asia/Karachi) |
| `ZKTIME_DEFAULT_COMPANY_SLUG` | No | Company slug for employees pulled from ZKTime (default: `xorora`) |

On Vercel, `AUTH_URL` can often be omitted in production because Auth.js uses `trustHost: true` and infers the host from `VERCEL_URL`. Set it explicitly if redirects or callbacks misbehave.

### ZKTime (biometric)

K40 devices connect to **ZKTime** on the office LAN. AMS pulls attendance and employees from the ZKTime bridge API and pushes new hires back for device enrollment. See **[docs/AMS-INTEGRATION.md](./docs/AMS-INTEGRATION.md)** for architecture, env vars, and setup.

---

## Neon (database)

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **connection string** (pooled driver URL works with `@neondatabase/serverless`).
3. Set `DATABASE_URL` in `.env.local` and in Vercel environment variables.
4. Apply the schema: `bun run db:push`.

### Admin workflow

In **Admin → Employees**, pre-create people with a unique **employee code**, full name, and **Workspace email**, or let them self-register on first sign-in. Pre-creating is useful when HR needs to set department, probation, or the display name before the employee logs in.

### Employee onboarding

1. Employee signs in with Google at `/`.
2. If the account is not yet linked to a record, they are sent to **`/register`** to enter their employee code.
3. Registration links to an existing active record when the **email** or **code** matches; if neither exists, a new employee record is created from their Google profile and the code they entered.
4. If an admin pre-created a record with the same email, the next login or registration step auto-links (no duplicate record).
5. Linked employees use **`/dashboard`** for check-in, breaks, and check-out. Unlinked employees cannot access attendance APIs until registration completes.

---

## Shift & attendance rules

| Rule | Value |
|------|-------|
| Timezone | Asia/Karachi (PKT) |
| Expected check-in | 18:00 on shift date |
| Late threshold | After 18:30 PKT |
| Expected check-out | 03:00 next calendar morning |
| Shift date boundary | Before noon PKT → previous calendar day's shift |
| Max break | 60 minutes per shift |
| Weekends | Office closed (no check-in; cron skips auto-absent) |

Employees must allow browser location; requests outside the geofence radius return **403** with a clear message.

---

## Leave entitlements

Configured in [`src/lib/leave/constants.ts`](src/lib/leave/constants.ts).

| Type | Annual days | Day counting | Approval | Notes |
|------|-------------|--------------|----------|-------|
| Annual | 14 | Working days (Mon–Fri) | Auto-approved | Weekends excluded from count |
| Casual | 10 | Calendar days | Admin required | — |
| Sick | 8 | Calendar days | Admin required | Medical certificate note required |

Approved leave syncs to attendance as `leave` status for each applicable shift date.

---

## Probation

Admins can enable probation when creating or editing an employee:

- Default period: **3 months** (configurable 1–24 months)
- Employees **on probation** cannot access leave (`/leave` shows status; nav item hidden)
- Admins can start or end probation from the employee sheet
- Progress is shown as days spent vs total days until end date

---

## Deploy on Vercel

1. Import the Git repository in [Vercel](https://vercel.com/new).
2. Framework preset: **Next.js**. Build command: `bun run build`.
3. Add all [environment variables](#environment-variables) for **Production** (and **Preview** if needed). Never commit `.env` or `.env.local`.
4. Run `bun run db:push` locally against production `DATABASE_URL` once, or use a CI step / Neon branch workflow before first deploy.
5. Deploy. Add the production URL to Google OAuth redirect URIs if not done yet.
6. **Cron:** [`vercel.json`](./vercel.json) registers a daily job:

   | Path | Schedule (UTC) | Purpose |
   |------|----------------|---------|
   | `/api/cron/mark-absent` | `0 23 * * *` | Mark absent (~04:00 PKT) |
   | `/api/sync/attendance` | `0 3 * * *` | Pull punches from ZKTime |
   | `/api/sync/employees` | `0 2 * * *` | Pull employees from ZKTime |

   - Set `CRON_SECRET` in Vercel. Vercel sends `Authorization: Bearer <CRON_SECRET>` when invoking cron routes.
   - Cron jobs require a Vercel plan that supports [Cron Jobs](https://vercel.com/docs/cron-jobs).
   - The job marks **absent** for active employees with no check-in on the completed shift date. Weekends, leave, and manual records are skipped.

7. Remove `BOOTSTRAP_ADMIN_EMAIL` from Vercel env after the first admin has signed in.

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Start production server locally |
| `bun run lint` | Biome check (lint + format) |
| `bun run format` | Biome format write |
| `bun run typecheck` | TypeScript check |
| `bun run db:push` | Apply Drizzle schema to Neon |
| `bun run db:migrate` | Run SQL migrations |
| `bun run db:generate` | Generate migration files |
| `bun run db:studio` | Drizzle Studio |

## Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Public | Landing page, Google sign-in; redirects signed-in users |
| `/register` | Signed-in employee | Link account with employee code |
| `/dashboard` | Linked employee | Check-in, breaks, check-out, live status |
| `/leave` | Linked employee | Leave balances, apply, cancel pending requests |
| `/admin/employees` | Admin | Employee CRUD, probation |
| `/admin/attendance` | Admin | Shift records — list, create, edit, delete |
| `/admin/leave` | Admin | Review and approve/reject leave requests |
| `/admin/reports` | Admin | Date-range summary report |
| `/admin/reports/[employeeId]` | Admin | Per-employee report drill-down |
| `/admin/devices` | Admin | ZKTime sync status and biometric terminals |

### API routes

| Prefix | Purpose |
|--------|---------|
| `/api/auth/*` | Auth.js handlers |
| `/api/attendance/*` | Check-in, check-out, break start/end, today's status |
| `/api/admin/employees/*` | Employee CRUD and deactivation |
| `/api/admin/attendance/*` | Attendance CRUD and status updates |
| `/api/admin/reports/*` | Summary data and Excel export |
| `/api/cron/mark-absent` | Daily auto-absent job (Bearer `CRON_SECRET`) |
| `/api/sync/attendance` | Pull attendance from ZKTime (Bearer `CRON_SECRET`) |
| `/api/sync/employees` | Pull/push employees via ZKTime (Bearer `CRON_SECRET`) |

Leave actions use Next.js Server Actions in [`src/lib/leave/actions.ts`](src/lib/leave/actions.ts).

## Project layout

```
src/
  app/                    # App Router pages and API routes
    (app)/                # Authenticated pages (dashboard, admin, leave)
    api/                  # REST handlers (attendance, admin, cron)
    register/             # Employee code linking
  auth.ts                 # Auth.js configuration
  db/                     # Drizzle schema and client
  lib/
    attendance/           # Shift rules, status, geofence, cron job
    auth/                 # Navigation, register/link employee, domain checks
    admin/                # Employees, attendance, reports, probation
    leave/                # Leave service, balances, working-day math
    zktime/               # ZKTime bridge client and device sync
  instrumentation.ts      # Validates required env on server start
  proxy.ts                # Auth guard (Next.js 16 proxy convention)
  components/             # UI (admin, attendance, leave, auth, shadcn)
vercel.json               # Cron schedule for auto-absent
drizzle/                  # SQL migrations
```

## License

See [LICENSE](./LICENSE).
