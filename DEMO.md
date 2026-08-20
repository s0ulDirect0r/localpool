# LocalPool — 10-minute demo runbook

## Setup (once, ~2 min before the meeting)

```bash
# Terminal 1 — backend
cd server
npm install
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm run seed     # loads demo accounts + live state into ./localpool.db
npm start        # http://localhost:4000

# Terminal 2 — client (repo root)
npm install
npm run web      # opens in browser; or: npm run ios
```

To reset between run-throughs: stop the server, `rm server/localpool.db*`,
then `npm run seed && npm start` again.

## Demo accounts (password for all: `demo1234`)

| Account | Role | State |
|---|---|---|
| `maya@demo.com` | driver | Online, Home→Work, 3 open seats, 5.0★ |
| `sam@demo.com` | rider | Pending request Home→Work, 5.0★ |
| `riley@demo.com` | rider | Pending request Gym→Work, unrated |
| `alex@demo.com` | rider | Clean account — the guest plays this one |

## Script

Open **two browser windows** side by side (or your phone + a browser).

1. **Window 1 — the driver.** Sign in as `maya@demo.com`. Toggle to
   **Driver** mode → "Manage requests". Maya is already online; Sam's and
   Riley's requests are waiting. Tap a rider's name → their public profile
   (rating, bio — note no email/phone shown pre-accept). **Accept Sam.**

2. **Window 2 — hand it to the guest.** Sign in as `alex@demo.com`, or
   better, let her **sign up with her own name**. Rider mode → "Request a
   carpool" → Home→Work, 1 seat. Matches screen shows **Maya Rodriguez —
   5.0★, Toyota Prius, 3 open seats**. Tap "Join this carpool".

3. **Back in Window 1**, Alex now appears under Accepted (polling, ~4s).
   Tap **Start driving**.

4. **Window 2** updates on its own within ~3s: "On the road", with
   Maya's contact info now visible under Travel companions (participants
   can coordinate; strangers can't see it).

5. **Window 1**: **Mark trip complete** → the rating screen appears
   automatically on *both* windows. Rate each other 5★ with a comment.

6. **Window 2**: open Maya's profile — her rating count just went up.
   Check **History** — the completed ride is there with fare.

## Talking points

- Carpool-first: fares are ~45% below solo because seats are shared;
  the driver sees cumulative earnings as riders join.
- Real backend: JWT auth with bcrypt passwords, SQLite, 52 passing
  integration tests. Not a click-through mockup — she can sign up live.
- Privacy: contact info is only exchanged between matched trip
  participants, never on discovery screens.
- Honest framing: matching is distance-scored on saved places; real
  geocoding/maps, payments, and push notifications are the obvious
  next milestones.
```