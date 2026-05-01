import { beforeEach, describe, expect, it } from 'vitest';
import { PLACES, call, createUser, makeApp } from './helpers.js';

type Setup = {
  app: ReturnType<typeof makeApp>['app'];
  driverToken: string;
  driverId: string;
  riderAToken: string;
  riderAId: string;
  riderBToken: string;
  riderBId: string;
  tripId: string;
};

async function setupCompletedTrip(): Promise<Setup> {
  const { app } = makeApp();
  const driver = await createUser(app, 'driver@example.com');
  const riderA = await createUser(app, 'a@example.com', 'hunter22', 'Alice');
  const riderB = await createUser(app, 'b@example.com', 'hunter22', 'Bob');

  const trip = await call(
    app,
    'POST',
    '/driver/trip',
    { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
    driver.token,
  );
  const tripId = trip.data.trip.id;

  for (const t of [riderA.token, riderB.token]) {
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      t,
    );
    await call(app, 'POST', '/rider/join', { trip_id: tripId }, t);
  }
  await call(app, 'POST', '/driver/start', undefined, driver.token);
  await call(app, 'POST', '/driver/complete', undefined, driver.token);

  return {
    app,
    driverToken: driver.token,
    driverId: driver.user.id,
    riderAToken: riderA.token,
    riderAId: riderA.user.id,
    riderBToken: riderB.token,
    riderBId: riderB.user.id,
    tripId,
  };
}

describe('participants', () => {
  let s: Setup;
  beforeEach(async () => {
    s = await setupCompletedTrip();
  });

  it('returns driver + non-cancelled riders for a participant', async () => {
    const res = await call(
      s.app,
      'GET',
      `/rides/${s.tripId}/participants`,
      undefined,
      s.riderAToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.driver.id).toBe(s.driverId);
    expect(res.data.riders.length).toBe(2);
    const ids = res.data.riders.map((r: any) => r.profile.id).sort();
    expect(ids).toEqual([s.riderAId, s.riderBId].sort());
  });

  it('rejects non-participants', async () => {
    const stranger = await createUser(s.app, 'stranger@example.com');
    const res = await call(
      s.app,
      'GET',
      `/rides/${s.tripId}/participants`,
      undefined,
      stranger.token,
    );
    expect(res.status).toBe(403);
    expect(res.data.error).toBe('not_a_participant');
  });
});

describe('public profile', () => {
  it('returns aggregated rating after a completed trip and rating', async () => {
    const s = await setupCompletedTrip();
    await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 5, comment: 'Great driver' },
      s.riderAToken,
    );
    await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 4 },
      s.riderBToken,
    );
    const res = await call(s.app, 'GET', `/users/${s.driverId}`, undefined, s.riderAToken);
    expect(res.status).toBe(200);
    expect(res.data.profile.rating_avg).toBe(4.5);
    expect(res.data.profile.rating_count).toBe(2);
    expect(res.data.profile.rides_as_driver).toBe(1);
    expect(res.data.profile.rides_as_rider).toBe(0);
  });

  it('does not leak password_hash', async () => {
    const s = await setupCompletedTrip();
    const res = await call(s.app, 'GET', `/users/${s.driverId}`, undefined, s.riderAToken);
    expect(res.data.profile.password_hash).toBeUndefined();
  });

  it('returns 404 for an unknown user', async () => {
    const { app } = makeApp();
    const u = await createUser(app, 'me@example.com');
    const res = await call(app, 'GET', '/users/usr_nonexistent', undefined, u.token);
    expect(res.status).toBe(404);
    expect(res.data.error).toBe('user_not_found');
  });

  it('PATCH /me updates bio and exposes it via the public profile', async () => {
    const { app } = makeApp();
    const u = await createUser(app, 'bio@example.com');
    await call(app, 'PATCH', '/me', { bio: 'Friendly carpool buddy' }, u.token);
    const res = await call(app, 'GET', `/users/${u.user.id}`, undefined, u.token);
    expect(res.data.profile.bio).toBe('Friendly carpool buddy');
  });
});

describe('ratings', () => {
  it('rider can rate driver and other riders after completion', async () => {
    const s = await setupCompletedTrip();
    const r1 = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 5 },
      s.riderAToken,
    );
    expect(r1.status).toBe(201);
    const r2 = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.riderBId, stars: 4, comment: 'Quiet, good company' },
      s.riderAToken,
    );
    expect(r2.status).toBe(201);
    expect(r2.data.rating.comment).toBe('Quiet, good company');
  });

  it('driver can rate every rider', async () => {
    const s = await setupCompletedTrip();
    for (const ratee of [s.riderAId, s.riderBId]) {
      const r = await call(
        s.app,
        'POST',
        `/rides/${s.tripId}/ratings`,
        { ratee_id: ratee, stars: 5 },
        s.driverToken,
      );
      expect(r.status).toBe(201);
    }
  });

  it('rejects self-rating', async () => {
    const s = await setupCompletedTrip();
    const r = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.riderAId, stars: 5 },
      s.riderAToken,
    );
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('cannot_rate_self');
  });

  it('rejects out-of-range stars', async () => {
    const s = await setupCompletedTrip();
    const r = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 7 },
      s.riderAToken,
    );
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('invalid_stars');
  });

  it('rejects rating before the trip is completed', async () => {
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
    // not completed yet
    const r = await call(
      app,
      'POST',
      `/rides/${trip.data.trip.id}/ratings`,
      { ratee_id: driver.user.id, stars: 5 },
      rider.token,
    );
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('trip_not_completed');
  });

  it('rejects rating a non-participant', async () => {
    const s = await setupCompletedTrip();
    const stranger = await createUser(s.app, 'stranger@example.com');
    const r = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: stranger.user.id, stars: 5 },
      s.riderAToken,
    );
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('ratee_not_a_completed_participant');
  });

  it('rejects ratings from a non-participant', async () => {
    const s = await setupCompletedTrip();
    const stranger = await createUser(s.app, 'stranger@example.com');
    const r = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 5 },
      stranger.token,
    );
    expect(r.status).toBe(403);
    expect(r.data.error).toBe('not_a_completed_participant');
  });

  it('prevents duplicate rater→ratee on the same trip', async () => {
    const s = await setupCompletedTrip();
    await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 5 },
      s.riderAToken,
    );
    const dup = await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 4 },
      s.riderAToken,
    );
    expect(dup.status).toBe(409);
    expect(dup.data.error).toBe('already_rated');
  });

  it('skips a rider who cancelled mid-trip from being a valid ratee', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd2@example.com');
    const stay = await createUser(app, 'stay@example.com');
    const bail = await createUser(app, 'bail@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    for (const t of [stay.token, bail.token]) {
      await call(
        app,
        'POST',
        '/rider/request',
        { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
        t,
      );
      await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, t);
    }
    await call(app, 'POST', '/rider/cancel', undefined, bail.token);
    await call(app, 'POST', '/driver/start', undefined, driver.token);
    await call(app, 'POST', '/driver/complete', undefined, driver.token);

    const r = await call(
      app,
      `POST`,
      `/rides/${trip.data.trip.id}/ratings`,
      { ratee_id: bail.user.id, stars: 5 },
      driver.token,
    );
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('ratee_not_a_completed_participant');

    // Driver can still rate the rider who stayed
    const ok = await call(
      app,
      'POST',
      `/rides/${trip.data.trip.id}/ratings`,
      { ratee_id: stay.user.id, stars: 5 },
      driver.token,
    );
    expect(ok.status).toBe(201);
  });

  it('lists submitted and received ratings for a participant', async () => {
    const s = await setupCompletedTrip();
    await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.driverId, stars: 5 },
      s.riderAToken,
    );
    await call(
      s.app,
      'POST',
      `/rides/${s.tripId}/ratings`,
      { ratee_id: s.riderAId, stars: 4 },
      s.driverToken,
    );
    const list = await call(
      s.app,
      'GET',
      `/rides/${s.tripId}/ratings`,
      undefined,
      s.riderAToken,
    );
    expect(list.status).toBe(200);
    expect(list.data.submitted.length).toBe(1);
    expect(list.data.submitted[0].ratee_id).toBe(s.driverId);
    expect(list.data.received.length).toBe(1);
    expect(list.data.received[0].rater_id).toBe(s.driverId);
  });
});

describe('history', () => {
  it('history items include trip_id for navigation to participants', async () => {
    const s = await setupCompletedTrip();
    const hist = await call(s.app, 'GET', '/rides/history', undefined, s.riderAToken);
    expect(hist.data.history.length).toBe(1);
    expect(hist.data.history[0].trip_id).toBe(s.tripId);
  });
});
