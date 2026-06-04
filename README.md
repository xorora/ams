# AMS — Attendance Management System

Employee attendance for night-shift teams (expected check-in **18:00**, check-out **03:00** next morning, **Asia/Karachi**). Built with Next.js, Neon PostgreSQL, and Auth.js (Google Workspace SSO).

## Features

- **Google Workspace SSO** — domain-restricted sign-in (`GOOGLE_WORKSPACE_HD`)
- **Employee dashboard** — geofenced check-in/out, break tracking (1 h max per shift), live shift status
- **Admin** — manage employees (code, email, department), view/edit attendance, Excel reports
- **Employee linking** — admins pre-create records; employees confirm with an **employee code** at `/register` (auto-linked when email already matches)
- **Cron** — marks absent when no check-in for the completed shift date
- **Deactivation safety** — admins can close an open shift when deactivating an employee who is still checked in or on break

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router, TypeScript) |
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

## Local setup

1. Clone and install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template and fill in values (see [Environment variables](#environment-variables) and provider sections below):

   ```bash
   cp .env.example .env.local
   ```

3. Push the database schema to Neon:

   ```bash
   bun run db:push
   ```

4. Run the dev server:

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. (Optional) Add shadcn components as needed:

   ```bash
   bunx shadcn@latest add button
   ```

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
| `CRON_SECRET` | Prod | Bearer token for the auto-absent cron route |
| `BOOTSTRAP_ADMIN_EMAIL` | Once | First login with this email becomes `admin`; remove after bootstrap |

On Vercel, `AUTH_URL` can often be omitted in production because Auth.js uses `trustHost: true` and infers the host from `VERCEL_URL`. Set it explicitly if redirects or callbacks misbehave.

---

## Neon (database)

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **connection string** (use the pooled driver URL if offered; `@neondatabase/serverless` works with Neon’s pooler).
3. Set `DATABASE_URL` in `.env.local` and in Vercel environment variables.
4. Apply the schema from your machine:

   ```bash
   bun run db:push
   ```

   For migration-based workflows instead of push:

   ```bash
   bun run db:generate
   bun run db:migrate
   ```

5. Inspect data (optional): `bun run db:studio`.

**Admin workflow:** In **Admin → Employees**, create each person with a unique **employee code**, full name, and **Workspace email** before they use attendance. Share the code with HR so new hires can link their account after Google sign-in.

**Employee onboarding:**

1. Admin creates the employee record (code + email must match the person’s Google account).
2. Employee signs in with Google at `/login`.
3. If the account is not yet linked to a record, they are sent to **`/register`** to enter their employee code. The code must match an active record whose email equals their Google email.
4. If they already signed in before the admin created the record, email match on the next login auto-links them (no code step). Otherwise they use `/register` once.
5. Linked employees use **`/dashboard`** for check-in, breaks, and check-out. Unlinked employees cannot access attendance APIs until registration completes.

---

## Google OAuth (Workspace)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Configure the **OAuth consent screen** (Internal for a single Workspace org, or External if publishing outside your org).
3. **Credentials → Create credentials → OAuth client ID → Web application**
4. **Authorized JavaScript origins**
   - `http://localhost:3000`
   - `https://<your-production-domain>` (Vercel URL or custom domain)
5. **Authorized redirect URIs**
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-production-domain>/api/auth/callback/google`
6. Copy **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. Set `GOOGLE_WORKSPACE_HD` to your Workspace primary domain (e.g. `acme.com`). Sign-in rejects other domains and unverified emails.

**Workspace restriction:** The app passes `hd=<domain>` on the Google authorize URL and validates `profile.hd` on callback. Keep the OAuth client restricted to your organization in the Google Admin console where possible.

**Bootstrap admin:** Set `BOOTSTRAP_ADMIN_EMAIL` to your admin’s Workspace email before the first login. That user receives `role=admin` on first sign-in. Remove the variable after at least one admin exists.

---

## Office geofence

Set real coordinates for your office:

- `OFFICE_LAT` / `OFFICE_LNG` — decimal degrees (e.g. `24.8607`, `67.0011`)
- `OFFICE_RADIUS_METERS` — how close employees must be to check in/out (default 100)

On first geofenced action, AMS seeds a single row into the `office_settings` table from these env vars. Later check-ins read from the database (change coordinates in DB or clear the row to re-seed from env).

Employees must allow browser location; requests outside the radius return **403** with a clear message.

Server startup validates required auth and office env via [`src/instrumentation.ts`](src/instrumentation.ts).

---

## Deploy on Vercel

1. Import the Git repository in [Vercel](https://vercel.com/new).
2. Framework preset: **Next.js**. Build command: `bun run build` (or enable Bun in project settings / use `npm run build` if you prefer npm on CI).
3. Add all [environment variables](#environment-variables) for **Production** (and **Preview** if you use preview deployments). Never commit `.env` or `.env.local`.
4. Run `bun run db:push` locally against production `DATABASE_URL` once, or use a CI step / Neon branch workflow before first deploy.
5. Deploy. Note the production URL for Google redirect URIs if you had not added them yet.
6. **Cron:** [`vercel.json`](./vercel.json) registers a daily job:

   | Path | Schedule (UTC) | Local (PKT) |
   |------|----------------|-------------|
   | `/api/cron/mark-absent` | `0 23 * * *` | ~**04:00** Asia/Karachi |

   - Set `CRON_SECRET` in Vercel. Vercel includes `Authorization: Bearer <CRON_SECRET>` when invoking cron routes (when the secret is configured).
   - Cron jobs require a Vercel plan that supports [Cron Jobs](https://vercel.com/docs/cron-jobs); enable them in the project after deploy.
   - The job marks **absent** for active employees with no check-in on the completed shift date (yesterday’s night shift relative to the run time).

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
| `/` | Public | Landing; redirects signed-in users |
| `/login` | Public | Google sign-in |
| `/register` | Signed-in employee | Link account with employee code |
| `/dashboard` | Linked employee | Check-in, breaks, check-out |
| `/admin/employees` | Admin | Employee CRUD |
| `/admin/attendance` | Admin | Shift records |
| `/admin/reports` | Admin | Summary and per-employee Excel export |

Attendance APIs live under `/api/attendance/*`; admin APIs under `/api/admin/*`.

## Project layout

```
src/
  app/              # App Router pages and API routes
  auth.ts           # Auth.js configuration
  db/               # Drizzle schema and client
  lib/
    attendance/     # Shift rules, status, geofence, close-open-shift
    auth/           # Navigation, register/link employee, domain checks
    admin/          # Employees, attendance, reports
  instrumentation.ts # Validates required env on server start
  proxy.ts          # Auth guard: /login, /register, /dashboard, /admin, APIs
  components/       # UI (admin, attendance, auth, shadcn)
vercel.json         # Cron schedule for auto-absent
```

## License

See [LICENSE](./LICENSE).
