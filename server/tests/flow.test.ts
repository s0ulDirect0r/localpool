import { describe, expect, it } from 'vitest';
import { PLACES, call, createUser, makeApp } from './helpers.js';

describe('rider + driver carpool flow', () => {
  it('rider sees the driver trip in matches and can join', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd1@example.com');
    const rider = await createUser(app, 'r1@example.com');

    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    expect(trip.status).toBe(201);

    const reqRes = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    expect(reqRes.status).toBe(201);
    expect(reqRes.data.request.fare).toBeGreaterThan(0);

    const matches = await call(app, 'GET', '/rider/matches', undefined, rider.token);
    expect(matches.status).toBe(200);
    expect(matches.data.matches.length).toBeGreaterThanOrEqual(1);
    const top = matches.data.matches[0];
    expect(top.trip.driver.email).toBe('d1@example.com');

    const join = await call(
      app,
      'POST',
      '/rider/join',
      { trip_id: top.trip.id },
      rider.token,
    );
    expect(join.status).toBe(200);
    expect(join.data.request.status).toBe('matched');
    expect(join.data.trip.seats_available).toBe(2);
  });

  it('driver progresses ride and rider sees status updates via /rider/active', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd2@example.com');
    const rider = await createUser(app, 'r2@example.com');

    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.airport, seats: 3 },
      driver.token,
    );
    const tripId = trip.data.trip.id;

    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.airport, seats: 1 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: tripId }, rider.token);

    let active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active.request.status).toBe('matched');
    expect(active.data.active.trip.id).toBe(tripId);

    const start = await call(app, 'POST', '/driver/start', undefined, driver.token);
    expect(start.status).toBe(200);
    expect(start.data.trip.status).toBe('in_progress');

    active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active.request.status).toBe('in_progress');
    expect(active.data.active.trip.status).toBe('in_progress');

    const done = await call(app, 'POST', '/driver/complete', undefined, driver.token);
    expect(done.status).toBe(200);
    expect(done.data.trip.status).toBe('completed');

    active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active).toBeNull();
  });

  it('driver accepts a passenger via /driver/accept and seats decrement', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd3@example.com');
    const rider = await createUser(app, 'r3@example.com');

    await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    const reqRes = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      rider.token,
    );
    const requestId = reqRes.data.request.id;

    const list = await call(app, 'GET', '/driver/requests', undefined, driver.token);
    expect(list.status).toBe(200);
    expect(list.data.requests.length).toBe(1);
    expect(list.data.requests[0].request.id).toBe(requestId);
    expect(list.data.requests[0].request.rider.email).toBe('r3@example.com');

    const accept = await call(
      app,
      'POST',
      '/driver/accept',
      { request_id: requestId },
      driver.token,
    );
    expect(accept.status).toBe(200);
    expect(accept.data.trip.seats_available).toBe(1);
    expect(accept.data.request.status).toBe('matched');
  });

  it('rejects join when seats are insufficient', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd4@example.com');
    const rider = await createUser(app, 'r4@example.com');

    await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      rider.token,
    );
    const matches = await call(app, 'GET', '/rider/matches', undefined, rider.token);
    expect(matches.data.matches.length).toBe(0);
  });

  it('prevents creating a second active request', async () => {
    const { app } = makeApp();
    const rider = await createUser(app, 'r5@example.com');
    const ok = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      rider.token,
    );
    expect(ok.status).toBe(201);
    const dup = await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.gym, seats: 1 },
      rider.token,
    );
    expect(dup.status).toBe(409);
  });

  it('cancels a matched ride and returns seats to the trip', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd6@example.com');
    const rider = await createUser(app, 'r6@example.com');

    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      rider.token,
    );
    await call(app, 'POST', '/rider/join', { trip_id: trip.data.trip.id }, rider.token);

    const before = await call(app, 'GET', '/driver/active', undefined, driver.token);
    expect(before.data.active.trip.seats_available).toBe(1);

    const cancel = await call(app, 'POST', '/rider/cancel', undefined, rider.token);
    expect(cancel.status).toBe(200);

    const after = await call(app, 'GET', '/driver/active', undefined, driver.token);
    expect(after.data.active.trip.seats_available).toBe(3);
  });

  it('driver cannot start without passengers', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd7@example.com');
    await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
      driver.token,
    );
    const start = await call(app, 'POST', '/driver/start', undefined, driver.token);
    expect(start.status).toBe(409);
  });

  it('driver cancel marks all matched riders cancelled', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd8@example.com');
    const rider = await createUser(app, 'r8@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
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

    const cancel = await call(app, 'POST', '/driver/cancel', undefined, driver.token);
    expect(cancel.status).toBe(200);

    const active = await call(app, 'GET', '/rider/active', undefined, rider.token);
    expect(active.data.active).toBeNull();
  });

  it('history returns completed rides for both parties', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd9@example.com');
    const rider = await createUser(app, 'r9@example.com');
    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 3 },
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
    await call(app, 'POST', '/driver/complete', undefined, driver.token);

    const driverHist = await call(app, 'GET', '/rides/history', undefined, driver.token);
    const riderHist = await call(app, 'GET', '/rides/history', undefined, rider.token);
    expect(driverHist.data.history.length).toBe(1);
    expect(driverHist.data.history[0].kind).toBe('driver');
    expect(driverHist.data.history[0].status).toBe('completed');
    expect(riderHist.data.history.length).toBe(1);
    expect(riderHist.data.history[0].kind).toBe('rider');
    expect(riderHist.data.history[0].status).toBe('completed');
  });

  it('multiple riders fill a trip and the third gets no matches', async () => {
    const { app } = makeApp();
    const driver = await createUser(app, 'd10@example.com');
    const r1 = await createUser(app, 'rA@example.com');
    const r2 = await createUser(app, 'rB@example.com');
    const r3 = await createUser(app, 'rC@example.com');

    const trip = await call(
      app,
      'POST',
      '/driver/trip',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 2 },
      driver.token,
    );
    const tripId = trip.data.trip.id;

    for (const t of [r1.token, r2.token]) {
      await call(
        app,
        'POST',
        '/rider/request',
        { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
        t,
      );
      await call(app, 'POST', '/rider/join', { trip_id: tripId }, t);
    }

    await call(
      app,
      'POST',
      '/rider/request',
      { pickup: PLACES.home, dropoff: PLACES.work, seats: 1 },
      r3.token,
    );
    const matches = await call(app, 'GET', '/rider/matches', undefined, r3.token);
    expect(matches.data.matches.length).toBe(0);
  });
});
