# LocalPool

Carpool-first ride-share demo. Expo app (iOS / Android / web) talking to a small Hono +
SQLite backend.

## Layout

```
.                  Expo client (App.tsx, src/)
server/            Hono + better-sqlite3 + JWT backend, with Vitest integration tests
```

## Run it

In one terminal — start the backend:

```bash
cd server
npm install
npm start          # listens on http://localhost:4000
```

In another terminal — start the Expo app:

```bash
npm install
npm run ios        # iOS simulator (requires macOS)
npm run android    # Android emulator
npm run web        # browser
```

Pointing the app at a non-default backend URL:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 npm run ios
```

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
npm test           # 22 tests across auth + flow
```

Coverage: signup happy/sad paths, signin happy/sad paths, `/me` auth, profile update,
seat clamping, full rider→matches→join, driver→accept→start→complete, status visible
to rider while driver progresses, insufficient seats rejected, double-active-request
rejected, cancellation refunds seats, driver cancel cascades to riders, history shape
for both roles, capacity exhaustion.
