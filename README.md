# LocalPool

Carpool-first ride-share demo built with Expo (iOS, Android, web).
Minimal UI, no backend — all matching is simulated locally.

## Run it

```bash
npm install
npm run ios       # iOS simulator (requires macOS)
npm run android   # Android emulator
npm run web       # browser
```

Or scan the QR code from `npm start` with the Expo Go app.

## What's in here

- **Auth** — name + email + phone signup, persisted with AsyncStorage.
- **Mode toggle** — switch between Rider and Driver from Home.
- **Rider flow** — pick pickup/dropoff/seats → see ranked carpool matches
  (driver, vehicle, ETA, detour, seats left, discounted fare) → select →
  active ride with simulated ETA countdown and trip progress.
- **Driver flow** — set route + available seats → "Go online" to browse
  passenger requests with overlapping itineraries → accept the ones that
  fit your remaining seats → start driving → complete the trip.
- **Active ride** — same screen for both roles; auto-progresses
  `driver_en_route → in_progress → completed`.
- **History + Profile** — local ride history and editable vehicle/seats.

## Layout

```
App.tsx                         provider + screen switcher
src/state/AppContext.tsx        auth + active ride + tick simulator
src/state/mock.ts               saved places, driver/passenger generators
src/screens/                    one file per screen
src/components/ui.tsx           Button, Card, Pill, typography
src/types.ts                    shared types
```

No external navigation library — `screen` lives in context and `App.tsx`
switches on it. Keeps the demo small.
