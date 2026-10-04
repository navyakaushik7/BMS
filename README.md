# Booth Management System — Full Stack

Real OTP-based login for MLAs (SMS via Twilio) + a Node.js/Express +
PostgreSQL API behind the React frontend, with JWT sessions and
ward-scoped data isolation. This replaces the earlier localStorage/demo-login
version with an actually runnable client-server app.

## What changed from the demo version

| | Demo version | This version |
|---|---|---|
| Login | Hardcoded username/password | Phone number → real OTP via SMS → verify |
| Data storage | Browser `localStorage` | PostgreSQL |
| Sessions | None | JWT, 12h expiry |
| Data isolation | Client-side only | Enforced server-side per `ward_id` on every query |
| Duplicate detection | — | DB unique constraint on `(ward_id, voter_card_id)` |
| Real-time sync | — | Socket.IO — other sessions in the same ward see live updates |

## What's new in this version

| Area | Change |
|---|---|
| Login | Split-screen page, plain words only (Login, Mobile number, Send OTP, Verify), 6-box OTP with paste/backspace, 30s resend |
| Layout | Collapsible sidebar (remembered), mobile drawer, top bar with ward switcher (admin), logout confirm |
| Overview | KPI cards (voters, booths, avg/booth, scheme coverage %, schemes, households), booth filter, **no "recently added" panel** |
| Charts | `SmartBarChart`: top-N horizontal bars, tail summarised + searchable "View all", compact numbers (K / L / Cr), height grows with rows. All aggregation in SQL |
| Schemes | Scheme-wise view: caste chart, filters (caste / religion / booth / search), edit voter, add / remove voters, edit scheme, Excel import / export / template |
| Booths | Edit booth, export a booth's voters to Excel |
| Excel | Template download; import updates by Voter ID and adds new; report export includes a **Scheme x Caste** sheet |
| Admin | Access page: add, **edit, revoke, restore, delete**. Revoke logs the user out on their next request. Last admin and self are protected |

### Test the charts at scale
```bash
cd backend
npm run seed:large            # 10,000 voters, 50 booths, 6 schemes
npm run seed:large -- 50000   # custom size
npm run seed:large -- --clear # remove the demo data
```

## Project layout

```
src/                      React frontend (Vite)
  lib/api.js               axios client, JWT attached automatically
  context/AuthContext.jsx  OTP login flow, session persistence
  pages/Login.jsx          two-step phone → OTP screen
  components/, pages/*     (your existing pages: plug them in — see below)
backend/                  Node.js/Express API
  server.js                app entry, Socket.IO setup
  src/routes/               auth, voters, booths, schemes, analytics, staff
  src/middleware/auth.js    JWT verification + ward-scoping helper
  src/utils/otp.js          OTP generation/hashing/verification
  src/utils/sms.js          Twilio sender (falls back to console in dev)
  sql/schema.sql            full Postgres schema
  sql/seed.sql              sample wards/users/booths/schemes
docker-compose.yml        one command: postgres + backend + frontend
```

## Quick start (Docker — easiest)

```bash
cp backend/.env.example backend/.env   # edit JWT_SECRET at minimum
docker compose up --build
```
- Frontend: http://localhost:8080
- Backend API: http://localhost:4000/api/health
- Postgres: localhost:5432 (user `bms_user` / pass `bms_password`)

The backend container automatically runs migrations + seed data on startup.

## Quick start (without Docker)

**1. Postgres** — create a database, then:
```bash
cd backend
cp .env.example .env        # set DATABASE_URL, JWT_SECRET
npm install
npm run migrate             # creates tables
npm run seed                # inserts sample wards/users/booths/schemes
npm run dev                 # http://localhost:4000
```

**2. Frontend**
```bash
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # http://localhost:5173
```

## Sending real OTPs (Twilio)

By default (no Twilio credentials set), OTPs are **not** texted — they're
printed to the backend terminal and also returned in the API response as
`dev_otp`, so you can develop without an SMS bill. The Login page shows this
dev code directly on screen when it's present.

To send real SMS:
1. Create a Twilio account, buy/verify a number, get your Account SID + Auth Token.
2. Fill in `backend/.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_FROM_NUMBER=+1xxxxxxxxxx
   ```
3. Restart the backend. `dev_otp` stops being returned; the code goes out as
   a real text to the phone number instead.

## Seeded demo phone numbers

| Phone | Role | Ward |
|---|---|---|
| `+919999900001` | MLA | Amritsar North |
| `+919999900002` | MLA | Jalandhar Central |
| `+919999900000` | Admin | (all wards) |

Replace these with real MLA numbers in `backend/sql/seed.sql` (or add them
via the Staff & Access admin page / `POST /api/staff`) before real use.

## How ward data isolation works

Every JWT carries the logged-in user's `wardId`. Every voter/booth/scheme
query on the backend filters `WHERE ward_id = <that value>` — an MLA's
token simply cannot fetch or modify another ward's data, regardless of
what the frontend sends. Admin accounts (`ward_id = NULL`) can pass
`?ward_id=` explicitly to view a specific ward.

## Full page-by-page architecture (all built and wired)

```
src/
  main.jsx                    → App.jsx
  App.jsx                     ThemeProvider → AuthProvider → Gate
                               Gate: no user → Login | user → AuthenticatedApp
                               AuthenticatedApp: DataProvider → Shell → active page
  context/
    AuthContext.jsx           OTP login, JWT persisted in localStorage, /me on boot
    ThemeContext.jsx          dark/light class on <html>, persisted + OS-matched
    DataContext.jsx           booths/schemes/wards for the active ward,
                               admin ward switcher, joins the Socket.IO ward room
  lib/
    api.js                    axios instance, JWT attached to every request,
                               401 → clears session automatically
    socket.js                 shared Socket.IO client singleton
  components/
    Shell.jsx                 sidebar nav + top bar (ward label, theme, logout, "Live" indicator)
    StatCards.jsx              5 stat tiles (total/voted/pending/turnout/booths)
    charts/AnalyticsCharts.jsx bar chart (booth turnout) + pie chart (scheme enrolment)
    FilterPanel.jsx            search + age/booth/scheme/status filters
    VoterTable.jsx              sortable list, inline voted-toggle, edit/delete
    VoterModal.jsx              insert/edit form
  pages/
    Login.jsx                  phone → OTP → verify
    Overview.jsx                dashboard: stats, charts, recent voters, live-refreshing
    VoterRegister.jsx           filters + table + modal + Excel import/export, live-refreshing
    Booths.jsx                  accordion per booth, add/delete booth
    Schemes.jsx                 grouped by category, add/delete scheme
    Reports.jsx                 booth turnout + scheme coverage tables, Excel export
    Staff.jsx                   admin-only: list/add/revoke login accounts
    Settings.jsx                account info, theme toggle, ward management (admin)
  utils/excelUtils.js          export voters/report to .xlsx, parse an uploaded
                               .xlsx into rows for POST /voters/bulk-import
```

**Data flow, sequentially, for a page like Voter Register:**
1. `AuthContext` holds the JWT → `wardId` baked into it.
2. `DataContext` fetches that ward's booths/schemes once, and joins the
   ward's Socket.IO room.
3. `VoterRegister` fetches voters filtered by `wardId` + whatever's in
   `FilterPanel`'s state.
4. Any create/update/delete goes through `lib/api.js` → Express route →
   Postgres (ward-scoped query) → the route also emits a Socket.IO event to
   that ward's room.
5. Every open tab/session in that ward receives the socket event and
   silently refetches — that's the "real-time sync."

I verified this builds cleanly (`npm run build` succeeds, zero errors) and
every backend route file passes `node --check`. I wasn't able to spin up
Postgres/Docker inside this sandbox to run a full live end-to-end request,
so give the Quick Start below a run and let me know if anything doesn't
come up clean — happy to debug from there.

## Security notes

- OTP codes are stored **hashed** (bcrypt), never in plaintext.
- OTP requests are rate-limited (cooldown + max attempts) to blunt brute-forcing.
- Change `JWT_SECRET` to a long random value before any real deployment.
- Put this behind HTTPS in production — JWTs and OTPs should never travel over plain HTTP.
# BMS
