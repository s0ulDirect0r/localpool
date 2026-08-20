import { describe, expect, it } from 'vitest';
import { PLACES, call, createUser, makeApp } from './helpers.js';

describe('PII handling', () => {
  it('GET /users/:id returns no email/phone for someone other than yourself', async () => {
    const { app } = makeApp();
    const me = await createUser(app, 'me@example.com');
    const other = await createUser(app, 'other@example.com', 'hunter22', 'Other Person', '555-9999');
    const res = await call(app, 'GET', `/users/${other.user.id}`, undefined, me.token);
    expect(res.status).toBe(200);
    expect(res.data.profile.name).toBe('Other Person');
    expect(res.data.profile.email).toBeUndefined();
    expect(res.data.profile.phone).toBeUndefined();
    expect(res.data.profile.password_hash).toBeUndefined();
  });

  it('GET /users/:id returns email/phone when viewing your own profile', async () => {
    const { app } = makeApp();
    const me = await createUser(app, 'self@example.com');
    const res = await call(app, 'GET', `/users/${me.user.id}`, undefined, me.token);
    expect(res.status).toBe(200);
    expect(res.data.profile.email).toBe('self@example.com');
    expect(res.data.profile.phone).toBeTruthy();
  });

  it('/rider/matches embeds public driver info only — no email/phone', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd@example.com', 'hunter22', 'D Person', '555-1111');
    const rider = await createUser(app, 'r@example.com');
    await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    const matches = await call(app, 'GET', '/rider/matches', undefined, rider.token);
    expect(matches.data.matches.length).toBe(1);
    const d = matches.data.matches[0].trip.driver;
    expect(d.name).toBe('D Person');
    expect(d.email).toBeUndefined();
    expect(d.phone).toBeUndefined();
  });

  it('/driver/requests embeds public rider info only — no email/phone', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd2@example.com');
    const rider = await createUser(app, 'r2@example.com', 'hunter22', 'R Person', '555-2222');
    await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    const reqs = await call(app, 'GET', '/driver/requests', undefined, driver.token);
    expect(reqs.data.requests.length).toBe(1);
    const r = reqs.data.requests[0].request.rider;
    expect(r.name).toBe('R Person');
    expect(r.email).toBeUndefined();
    expect(r.phone).toBeUndefined();
  });

  it('/rides/:tripId/participants DOES include contact info for participants (they share a trip)', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd3@example.com', 'hunter22', 'Driver Three', '555-3333');
    const rider = await createUser(app, 'r3@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, rider.token);

    const res = await call(
      app,
      'GET',
      `/rides/${trip.data.trip.id}/participants`,
      undefined,
      rider.token,
    );
    expect(res.status).toBe(200);
    expect(res.data.driver.email).toBe('d3@example.com');
    expect(res.data.driver.phone).toBe('555-3333');
  });

  it('/rider/active embeds driver contact info (you need to coordinate)', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd4@example.com', 'hunter22', 'Driver Four', '555-4444');
    const rider = await createUser(app, 'r4@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, rider.token);

    const active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active.trip.driver.email).toBe('d4@example.com');
    expect(active.data.active.trip.driver.phone).toBe('555-4444');
  });

  it('/driver/active embeds rider contact info (you need to coordinate)', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd5@example.com');
    const rider = await createUser(app, 'r5@example.com', 'hunter22', 'Rider Five', '555-5555');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, rider.token);

    const active = await call(app, 'GET', '/driver/active', undefined, driver.token);
    expect(active.data.active.requests[0].rider.email).toBe('r5@example.com');
    expect(active.data.active.requests[0].rider.phone).toBe('555-5555');
  });
});

describe('driver cancels mid-ride', () => {
  it('rider sees active=null and cannot post a rating against the trip', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd@example.com');
    const rider = await createUser(app, 'r@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, rider.token);
    await call(app, 'POST', '/driver/start', undefined, driver.token);
    await call(app, 'POST', '/driver/cancel', undefined, driver.token);

    const active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active).toBeNull();

    // Rider tries to rate the cancelled-into-them trip.
    const rate = await call(
      app,
      'POST',
      `/rides/${trip.data.trip.id}/ratings`,
      { ratee_id: driver.user.id, stars: 5 },
      rider.token,
    );
    expect(rate.status).toBe(409);
    expect(rate.data.error).toBe('trip_not_completed');

    // And rider can no longer access the participants endpoint — their
    // request was cancelled, so they're not a participant anymore.
    const parts = await call(
      app,
      'GET',
      `/rides/${trip.data.trip.id}/participants`,
      undefined,
      rider.token,
    );
    expect(parts.status).toBe(403);
  });
});

describe('post-trip participants', () => {
  it('excludes riders whose requests never matched (e.g. still pending)', async () => {
    // A driver with two riders: one matched + completed, one whose request
    // was never accepted. The post-trip participants list should only include
    // the rider who actually rode.
    const { app } = makeApp();
    const driver = await createUser(app, 'd@example.com');
    const rode = await createUser(app, 'rode@example.com', 'hunter22', 'Rode');
    const ghost = await createUser(app, 'ghost@example.com', 'hunter22', 'Ghost');

    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    const tripId = trip.data.trip.id;

    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rode.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: tripId }, rode.token);

    // Ghost requests but never joins — request stays `pending`, then we
    // simulate the trip running and completing without them.
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      ghost.token,
    );

    await call(app, 'POST', '/driver/start', undefined, driver.token);
    await call(app, 'POST', '/driver/complete', undefined, driver.token);

    const parts = await call(app, 'GET', `/rides/${tripId}/participants`, undefined, driver.token);
    expect(parts.status).toBe(200);
    const names = parts.data.riders.map((r: any) => r.profile.name);
    expect(names).toEqual(['Rode']);
  });
});

describe('input validation', () => {
  it('rejects driver/trip with absurd seats', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd@example.com');
    const res = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 999 },
      driver.token,
    );
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('invalid_seats');
  });

  it('rejects rider/request with absurd seats', async () => {
    const { app } = makeApp();
    const rider = await createUser(app, 'r@example.com');
    const res = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 999 },
      rider.token,
    );
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('invalid_seats');
  });

  it('rejects rider/request with seats=0', async () => {
    const { app } = makeApp();
    const rider = await createUser(app, 'r@example.com');
    const res = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 0 },
      rider.token,
    );
    expect(res.status).toBe(400);
  });
});
