# FitAdapt

A working Malay-language adaptive workout application: Node.js, Express, vanilla HTML/CSS/JavaScript, Chart.js, and **Turso Cloud (libSQL)**. Local SQLite development and the original MySQL adapter are also available.

The database choice follows the user's Turso preference. `PROMPT_SYSTEM.md` is the original product specification; it has been preserved unchanged.

## Run the existing local setup

Requires Node.js 22.13 or newer (developed with Node 24).

```powershell
npm install
npm start
```

Open **http://127.0.0.1:3000**. The existing `.env` uses a local SQLite database at `data/fitadapt.sqlite`, already migrated and seeded.

Demo accounts:

| Account | Password |
| --- | --- |
| `admin@fitadapt.com` | `SEED_ADMIN_PASSWORD` in your local `.env` |
| `user@fitadapt.com` | `SEED_USER_PASSWORD` in your local `.env` |

Passwords were randomly generated for this workspace and are not committed. You can also register a new user through the interface. Changing a seed password does not reset an existing account; use the in-app password form.

For a fresh checkout, copy `.env.example` to `.env`, select `DB_DRIVER=sqlite`, set both seed passwords (at least 8 characters), then run `npm run db:migrate` and `npm run db:seed`.

## Connect your Turso database

Use a dedicated Turso **libSQL** database. This adapter uses the official [`@libsql/client`](https://docs.turso.tech/sdk/ts/reference). The newer Turso engine has a separate SDK; this implementation targets the libSQL-compatible service.

1. Create the database in your Turso dashboard and copy its database URL and auth token.
2. Stop the local server and update these values in `.env` (keep secrets in the server environment, never in `public/`):

   ```dotenv
   DB_DRIVER=turso
   TURSO_DATABASE_URL=libsql://your-database-your-organisation.turso.io
   TURSO_AUTH_TOKEN=your-database-token
   SEED_ADMIN_PASSWORD=choose-a-strong-admin-password
   SEED_USER_PASSWORD=choose-a-strong-test-user-password
   ```

3. Initialize and start:

   ```powershell
   npm run db:migrate
   npm run db:seed
   npm start
   ```

4. Open `/api/health`; the response should show `"database":"turso"`.

The cloud database starts with a new seed. Switching `DB_DRIVER` does **not** upload your local users or logs. Migrations are repeatable and do not drop tables. `db/schema.turso.sql` contains the schema for inspection; `db/schema.sql` is the same Turso schema. The optional MySQL schema is in `db/schema.mysql.sql`.

Turso cloud connectivity has not been verified because no cloud URL/token was provided. The actual libSQL driver is tested against an in-memory database, including the complete authenticated API workflow, foreign keys, transactions, rollback, and plan generation.

## Features

- Landing, registration, terms/privacy pages, login, logout and password changes.
- Hashed passwords, opaque server-side sessions in HttpOnly cookies, CSRF tokens, same-origin mutation checks, rate-limited authentication and backend role checks.
- Four-step onboarding, 2–6 training days, equipment/experience/limitation filtering, two-week plans and muscle recovery checks.
- Dashboard, plan details, exercise alternatives, guided workouts, server-persisted sets, rest timer, per-set RPE, notes and 24-hour edit locks.
- Pure adaptive rules: progressive overload, high-effort hold, repeated-failure load reduction, plateau suggestions, missed-session scheduling/carry-over, and reduced future volume.
- In-app notifications, adaptation reasons, progress charts, streak/consistency statistics, profile changes effective tomorrow, and feedback.
- Admin exercise editing/activation, account suspension/deletion protections, feedback averages/CSV export, audit records and system statistics.
- 34 seeded exercises, equipment mappings, one admin and one onboarded test user.
- Responsive layout, keyboard focus, dialog controls, labeled forms, status text and chart data table.

## Verify

```powershell
npm test
npm run test:e2e
```

Unit/API tests use isolated in-memory SQLite/libSQL databases and do not alter your local app data. The browser suite requires the running app plus seeded credentials from `.env`, and uses installed Microsoft Edge by default. Set `BROWSER_CHANNEL=chrome` if appropriate. It creates feedback entries in the test app and saves desktop/mobile screenshots to ignored `test-results/`.

Tests cover specification scenarios T1–T14, ownership/RBAC/CSRF, account revocation and cascades, profile preservation, scheduler idempotence, and future-only adaptive changes. Browser checks cover login, user/admin pages, feedback and responsive overflow. Cloud latency, 4G loading and real-user usability have not been measured.

## Project layout

```text
config/       database adapters and adaptive thresholds
db/           schemas, migrations, seed accounts and exercise catalog
middleware/   authentication, roles, validation and API errors
routes/       authentication, user workflows and administration
services/     pure adaptive engine, plan generator, training, scheduler, statistics
public/       Malay interface, CSS, JS, local logo and bundled Chart.js
tests/        unit, integration, Turso adapter and browser checks
server.js     Express app and Malaysia-time scheduled job
```

## Operation and deployment

### Vercel

The root `server.js` exports a request handler that initializes the database once per function instance. Configure production environment variables `NODE_ENV=production`, `DB_DRIVER=turso`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a random `CRON_SECRET`. Keep preview deployments on a separate database. Local `.env` files are excluded by `.vercelignore`.

Run `db:migrate` and `db:seed` against the destination database before deployment. Migrations do not run during function cold starts. Seeding requires `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`; these credentials do not need to be uploaded to Vercel.

`vercel.json` configures Singapore hosting, static security headers, and an authenticated daily cron at 16:05 UTC (00:05 Malaysia time). Cron timing depends on the Vercel plan. Authentication rate limits are stored in the database so they are shared across function instances.

After linking with `vercel link`, deploy with `vercel --prod`. Check `/api/health`, login, the exercise catalogue, `/vendor/chart.js`, and rejection of unauthenticated `/api/cron/daily` requests.

### Persistent Node hosting

Run as a persistent Node process with a process manager on an HTTPS host. Set `NODE_ENV=production`, `DB_DRIVER=turso`, `HOST=0.0.0.0`, the port required by your host, and the two Turso secrets. Production cookies require HTTPS. If a trusted reverse proxy is used, configure Express proxy trust for that exact topology before relying on client-IP rate limiting.

The daily job runs at 00:05 Asia/Kuala_Lumpur. Dashboard/plan requests also reconcile missed sessions and extend the plan. An always-on process is needed for the daily job; a sleeping host reconciles when the user returns. Dates are stored in UTC; scheduled workout dates and week boundaries use Malaysia time.

An exercise catalogue may have too few safe exercises for some limitation/day combinations. The backend rejects an empty safe selection and explains how to adjust the profile. It never silently ignores limitations. Some tightly constrained equipment combinations can produce fewer exercises than the nominal 4–5. Carry-over respects equipment, limitations and adjacent muscle recovery; if no safe replacement exists, the focus remains recorded for review.

The generated legal text, generic exercise instructions, and catalogue are starter content for this MVP. Review them for your actual operator and audience before a public launch. Coach UI/API, email password recovery, push/email notifications and user log export remain out of MVP scope, as specified.

See the Vercel project dashboard for deployment status and URLs.

## Editing the React authentication pages

The login and registration screens use `components/ui/login.tsx`, adapted from the supplied split-screen React component. Reusable shadcn primitives live in `components/ui/`, with aliases configured by `components.json` and `tsconfig.json`. This conventional folder keeps component imports and future shadcn additions consistent. Styles live in `client/auth.css`; `client/auth.tsx` mounts React only on authentication routes. Other application pages remain in `public/js/app.js`.

Run `npm install`, `npm run typecheck`, and `npm run build` after editing these files. The build produces `public/js/auth.js` and `public/css/auth.css`; edit their sources rather than generated output. Start/dev rebuild once at startup; rerun the build after editing TSX or authentication styles. Vercel runs the build automatically. Use `npm run test:auth-browser` for the isolated registration/login browser checks (requires Microsoft Edge). Registration still requires a separate login. Password recovery and a Remember Me toggle are omitted because the existing API does not implement those features.
