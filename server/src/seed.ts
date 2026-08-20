// Seeds a demo database by driving the real API — same code paths as
// production requests, so all business rules apply to the seeded data.
//
// Usage:  JWT_SECRET=... npm run seed          (writes ./localpool.db)
//         JWT_SECRET=... DB_PATH=... npm run seed
//
// Idempotent-ish: refuses to run if demo accounts already exist.

import { createApp } from './app.js';

const dbPath = process.env.DB_PATH ?? './localpool.db';
const secret = process.env.JWT_SECRET ?? 'seed-only-secret-not-used-at-runtime';

const { app, db } = createApp({ dbPath, secret });

const PLACES = {
  home: { label: 'Home', lat: 37.7749, lng: -122.4194 },
  work: { label: 'Work', lat: 37.7858, lng: -122.4065 },
  gym: { label: 'Gym', lat: 37.7694, lng: -122.4862 },
  airport: { label: 'Airport (SFO)', lat: 37.6213, lng: -122.379 },
};

async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await app.request(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status >= 400) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return { status: res.status, data };
}

async function main() {
  const existing = db
    .prepare(`SELECT id FROM users WHERE email = 'maya@demo.com'`)
    .get();
  if (existing) {
    console.log('Demo data already present — nothing to do.');
    console.log('Delete the DB file and re-run to reseed.');
    return;
  }

  console.log(`Seeding ${dbPath} ...`);

  // --- Accounts (password for all: demo1234) ---
  const signup = async (name: string, email: string, phone: string) =>
    (
      await call('POST', '/auth/signup', {
        name,
        email,
        phone,
        password: 'demo1234',
      })
    ).data as { token: string; user: { id: string } };

  const maya = await signup('Maya Rodriguez', 'maya@demo.com', '555-0101');
  const sam = await signup('Sam Chen', 'sam@demo.com', '555-0102');
  const riley = await signup('Riley Okafor', 'riley@demo.com', '555-0103');
  const alex = await signup('Alex Kim', 'alex@demo.com', '555-0104');

  await call(
    'PATCH',
    '/me',
    {
      vehicle: 'Toyota Prius (Silver)',
      seats: 3,
      bio: 'Commuting downtown every weekday. Coffee thermos always on board.',
    },
    maya.token,
  );
  await call('PATCH', '/me', { bio: 'Grad student, quiet rides preferred.' }, sam.token);
  await call('PATCH', '/me', { bio: 'Early riser. Happy to split gas + tolls.' }, riley.token);
  await call('PATCH', '/me', { bio: 'New in town, trying to ditch my car.' }, alex.token);

  // --- A completed trip in the past: Maya drove Sam, they rated each other ---
  await call('POST', '/driver/trip', { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 }, maya.token);
  await call('POST', '/rider/request', { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 }, sam.token);
  const mayaTrip1 = (await call('GET', '/rider/matches', undefined, sam.token)).data
    .matches[0].trip;
  await call('POST', '/rider/join', { trip_id: mayaTrip1.id }, sam.token);
  await call('POST', '/driver/start', undefined, maya.token);
  await call('POST', '/driver/complete', undefined, maya.token);
  await call(
    'POST',
    `/rides/${mayaTrip1.id}/ratings`,
    { ratee_id: maya.user.id, stars: 5, comment: 'Right on time, smooth ride.' },
    sam.token,
  );
  await call(
    'POST',
    `/rides/${mayaTrip1.id}/ratings`,
    { ratee_id: sam.user.id, stars: 5, comment: 'Great carpool company!' },
    maya.token,
  );

  // --- Live state for the demo ---
  // Maya is back online with a fresh trip and open seats.
  await call('POST', '/driver/trip', { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 }, maya.token);
  // Sam and Riley have pending requests a driver can browse and accept.
  await call('POST', '/rider/request', { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 }, sam.token);
  await call('POST', '/rider/request', { pickup: PLACES.gym, dropoff: PLACES.work, seats: 1 }, riley.token);
  // Alex is left clean — sign in as Alex (or sign up fresh) to play the rider.

  console.log(`
Seeded. Demo accounts (password for all: demo1234):

  maya@demo.com   driver — ONLINE with a Home→Work trip, 3 open seats,
                  5.0★ from a completed ride
  sam@demo.com    rider  — pending request (Home→Work), 5.0★
  riley@demo.com  rider  — pending request (Gym→Work), no ratings yet
  alex@demo.com   rider  — free account with no active state

Suggested demo:
  Window 1: sign in as maya@demo.com → Driver mode → sees Sam's and
            Riley's requests → accept → start → complete → rate.
  Window 2: sign in as alex@demo.com (or sign up fresh) → Rider mode →
            request Home→Work → Maya's trip appears as a match → join →
            watch the status update live as Maya progresses the trip.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
