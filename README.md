# LocalPool

Carpool-first ride-share demo. Expo app (iOS / Android / web) talking to a small Hono +
SQLite backend.

## Layout

```
.                  Expo client (App.tsx, src/)
server/            Hono + better-sqlite3 + JWT backend, with Vitest integration tests
```

> **Demoing this to someone?** See [DEMO.md](./DEMO.md) — one seed command
> pre-loads demo accounts, an online driver, pending requests, and ratings.

## Run it

In one terminal — start the backend:

```bash
cd server
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm start
# listens on http://localhost:4000
```

`JWT_SECRET` is required (≥ 16 chars). The server refuses to boot without it.

In another terminal — start the Expo app:

```bash
npm install
npm run web        # browser, talks to http://localhost:4000 by default
npm run ios        # iOS simulator (requires macOS)
npm run android    # Android emulator (use 10.0.2.2 instead of localhost)
```

### Running on a physical phone via Expo Go

`localhost` on a phone refers to the phone itself, so you have to point the
app at the dev machine's LAN IP and the server has to bind to that interface
too.

```bash
# 1. Find your LAN IP (e.g. 192.168.1.50)
ipconfig getifaddr en0   # macOS
hostname -I              # Linux

# 2. Start the server on all interfaces:
HOST=0.0.0.0 PORT=4000 JWT_SECRET=... npm start

# 3. Start Expo with the LAN URL baked in:
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 npm run ios   # or :android
```

The app's `app.json` enables an iOS App Transport Security exception
(`NSAllowsArbitraryLoads`) and Android cleartext traffic so the demo can
talk to a plain-HTTP local server. **Strip both before any production
build.**

## What's in here

**Auth** — bcrypt-hashed passwords, JWT stored in AsyncStorage, sign in / sign up flows
on the client.

**Rider flow** — pick pickup/dropoff/seats → server-side matching against active driver
trips → join a carpool → live ride status (polled every 3s) → cancel any time.

**Driver flow** — set route + seats → "Go online" → see real rider requests sized to
your remaining seats → accept passengers → start trip → complete; cancellations refund
seats and notify the rider on their next poll.

**History + Profile** — server-backed history of completed/cancelled rides as both
rider and driver; editable vehicle + seats.

## Backend

Hono running on Node, SQLite via better-sqlite3, JWT via jsonwebtoken,
passwords via bcryptjs.

```
server/src/
  app.ts        route definitions (createApp factory used by tests)
  index.ts      production entry point — starts node server
  db.ts         schema + DB factory (file or :memory:)
  auth.ts       hashing, JWT, auth middleware
  match.ts      simple distance-based scoring
  types.ts      shared row types
```

Routes:
- `POST /auth/signup`, `POST /auth/signin`, `GET /me`, `PATCH /me`
- Rider: `POST /rider/request`, `GET /rider/matches`, `POST /rider/join`,
  `GET /rider/active`, `POST /rider/cancel`
- Driver: `POST /driver/trip`, `GET /driver/requests`, `POST /driver/accept`,
  `POST /driver/start`, `POST /driver/complete`, `POST /driver/cancel`,
  `GET /driver/active`
- `GET /rides/history`

Environment:
- `PORT` (default `4000`)
- `DB_PATH` (default `./localpool.db`; use `:memory:` for ephemeral)
- `JWT_SECRET` (set this in production)

## Tests

Integration tests use Hono's `app.request()` against a fresh in-memory SQLite per test —
no port binding, no fixtures to clean up.

```bash
cd server
npm test           # 52 tests: auth, ride flow, ratings, PII/security
```

Coverage: auth happy/sad paths, `/me` auth and profile updates, the full
rider→matches→join and driver→accept→start→complete flows, cross-role status
visibility, seat accounting (races, refunds on cancel, capacity exhaustion,
bounds), driver-cancel cascades, ratings rules (completed-trip-only, participants
only, no self/duplicate rating), PII rules (contact info only between trip
participants, never on discovery surfaces), and history shapes for both roles.
