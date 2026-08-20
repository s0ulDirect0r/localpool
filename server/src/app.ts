import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  authMiddleware,
  contactUser,
  hashPassword,
  publicUser,
  signToken,
  verifyPassword,
  type AuthVars,
} from './auth.js';
import { openDb, type DB } from './db.js';
import { estimateFare, scoreTripForRequest } from './match.js';
import type {
  ContactUser,
  ProfileSummary,
  PublicUser,
  RatingRow,
  RequestRow,
  TripRow,
  UserRow,
} from './types.js';

type Env = { Variables: AuthVars };

export type AppOptions = {
  dbPath?: string;
  secret: string;
  db?: DB;
};

const MAX_SEATS = 7;

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getActiveRequest(db: DB, riderId: string): RequestRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM requests WHERE rider_id = ? AND status IN ('pending','matched','in_progress') ORDER BY created_at DESC LIMIT 1`,
      )
      .get(riderId) as RequestRow | undefined) ?? null
  );
}

function getActiveTrip(db: DB, driverId: string): TripRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM trips WHERE driver_id = ? AND status IN ('active','in_progress') ORDER BY created_at DESC LIMIT 1`,
      )
      .get(driverId) as TripRow | undefined) ?? null
  );
}

function getTrip(db: DB, tripId: string): TripRow | null {
  return (db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) as TripRow | undefined) ?? null;
}

function getRequestsForTrip(db: DB, tripId: string): RequestRow[] {
  return db
    .prepare('SELECT * FROM requests WHERE trip_id = ? ORDER BY created_at ASC')
    .all(tripId) as RequestRow[];
}

function loadUserRow(db: DB, userId: string): UserRow | null {
  return (db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined) ?? null;
}

function loadPublicUser(db: DB, userId: string): PublicUser | null {
  const row = loadUserRow(db, userId);
  return row ? publicUser(row) : null;
}

function loadContactUser(db: DB, userId: string): ContactUser | null {
  const row = loadUserRow(db, userId);
  return row ? contactUser(row) : null;
}

export function createApp(opts: AppOptions) {
  const db = opts.db ?? openDb(opts.dbPath);
  const secret = opts.secret;
  if (!secret) throw new Error('createApp requires opts.secret');

  const app = new Hono<Env>();
  // TODO: restrict to known origins in production.
  app.use('*', cors());

  app.get('/health', (c) => c.json({ ok: true }));

  // ---------- Auth ----------
  app.post('/auth/signup', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const { name, email, phone, password } = body as Record<string, string>;
    if (!name?.trim() || !email?.includes('@') || !phone?.trim() || !password) {
      return c.json({ error: 'missing_fields' }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: 'password_too_short' }, 400);
    }
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email.toLowerCase().trim());
    if (existing) return c.json({ error: 'email_taken' }, 409);

    const userId = id('usr');
    const hash = await hashPassword(password);
    db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, vehicle, seats, bio, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
    ).run(userId, name.trim(), email.toLowerCase().trim(), phone.trim(), hash, Date.now());
    const user = loadContactUser(db, userId)!;
    const token = signToken(secret, userId);
    return c.json({ token, user }, 201);
  });

  app.post('/auth/signin', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const { email, password } = body as Record<string, string>;
    if (!email || !password) return c.json({ error: 'missing_fields' }, 400);
    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as UserRow | undefined;
    if (!row) return c.json({ error: 'invalid_credentials' }, 401);
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return c.json({ error: 'invalid_credentials' }, 401);
    const token = signToken(secret, row.id);
    return c.json({ token, user: contactUser(row) });
  });

  // ---------- Authenticated routes ----------
  const auth = authMiddleware(db, secret);

  app.get('/me', auth, (c) => c.json({ user: c.get('user') }));

  app.patch('/me', auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const userId = c.get('userId');
    const { vehicle, seats, name, phone, bio } = body as Record<string, unknown>;
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (typeof vehicle === 'string') {
      updates.push('vehicle = ?');
      values.push(vehicle.trim() || null);
    }
    if (typeof seats === 'number') {
      updates.push('seats = ?');
      values.push(Math.max(1, Math.min(MAX_SEATS, Math.floor(seats))));
    }
    if (typeof name === 'string' && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (typeof phone === 'string' && phone.trim()) {
      updates.push('phone = ?');
      values.push(phone.trim());
    }
    if (typeof bio === 'string') {
      updates.push('bio = ?');
      values.push(bio.trim() || null);
    } else if (bio === null) {
      updates.push('bio = ?');
      values.push(null);
    }
    if (updates.length) {
      values.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    return c.json({ user: loadContactUser(db, userId) });
  });

  // ---------- Rider ----------
  app.post('/rider/request', auth, async (c) => {
    const userId = c.get('userId');
    if (getActiveRequest(db, userId) || getActiveTrip(db, userId)) {
      return c.json({ error: 'already_active' }, 409);
    }
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const { pickup, dropoff, seats } = body as {
      pickup?: { label: string; lat: number; lng: number };
      dropoff?: { label: string; lat: number; lng: number };
      seats?: number;
    };
    if (!pickup || !dropoff || !seats) {
      return c.json({ error: 'missing_fields' }, 400);
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      return c.json({ error: 'invalid_seats' }, 400);
    }
    const fare = estimateFare(pickup, dropoff, true);
    const reqId = id('req');
    db.prepare(
      `INSERT INTO requests (id, rider_id, trip_id, pickup_label, pickup_lat, pickup_lng,
         dropoff_label, dropoff_lat, dropoff_lng, seats, fare, status, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(
      reqId,
      userId,
      pickup.label,
      pickup.lat,
      pickup.lng,
      dropoff.label,
      dropoff.lat,
      dropoff.lng,
      seats,
      fare,
      Date.now(),
    );
    const created = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId) as RequestRow;
    return c.json({ request: created }, 201);
  });

  // Discovery surface — embeds PUBLIC user info only (no email/phone).
  function tripWithPublicDriver(trip: TripRow) {
    return { ...trip, driver: loadPublicUser(db, trip.driver_id) };
  }

  // Active-trip surface — embeds CONTACT user info (you're sharing a ride
  // with this person, you need to be able to coordinate).
  function tripWithContactDriver(trip: TripRow) {
    return { ...trip, driver: loadContactUser(db, trip.driver_id) };
  }

  function requestWithPublicRider(req: RequestRow) {
    return { ...req, rider: loadPublicUser(db, req.rider_id) };
  }

  function requestWithContactRider(req: RequestRow) {
    return { ...req, rider: loadContactUser(db, req.rider_id) };
  }

  app.get('/rider/matches', auth, (c) => {
    const userId = c.get('userId');
    const req = getActiveRequest(db, userId);
    if (!req) return c.json({ error: 'no_active_request' }, 404);
    if (req.status !== 'pending') {
      return c.json({ matches: [], request: req });
    }
    const trips = db
      .prepare(
        `SELECT * FROM trips WHERE status = 'active' AND seats_available >= ?`,
      )
      .all(req.seats) as TripRow[];
    const scored = trips
      .map((t) => ({
        trip: tripWithPublicDriver(t),
        score: scoreTripForRequest(t, req),
        fare: req.fare,
      }))
      .sort((a, b) => a.score - b.score);
    return c.json({ matches: scored, request: req });
  });

  app.post('/rider/join', auth, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const tripId = (body as { trip_id?: string } | null)?.trip_id;
    if (!tripId) return c.json({ error: 'missing_trip_id' }, 400);
    const req = getActiveRequest(db, userId);
    if (!req || req.status !== 'pending') {
      return c.json({ error: 'no_pending_request' }, 409);
    }
    const trip = getTrip(db, tripId);
    if (!trip || trip.status !== 'active') {
      return c.json({ error: 'trip_unavailable' }, 409);
    }
    if (trip.seats_available < req.seats) {
      return c.json({ error: 'not_enough_seats' }, 409);
    }
    let success = false;
    const tx = db.transaction(() => {
      // Conditional decrement so that even under hypothetical concurrent
      // joins (multi-process), we never let seats go negative.
      const r = db
        .prepare(
          `UPDATE trips SET seats_available = seats_available - ?
           WHERE id = ? AND status = 'active' AND seats_available >= ?`,
        )
        .run(req.seats, trip.id, req.seats);
      if (r.changes === 1) {
        db.prepare(`UPDATE requests SET trip_id = ?, status = 'matched' WHERE id = ?`).run(
          trip.id,
          req.id,
        );
        success = true;
      }
    });
    tx();
    if (!success) return c.json({ error: 'not_enough_seats' }, 409);
    return c.json({
      request: db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id),
      trip: getTrip(db, trip.id),
    });
  });

  app.get('/rider/active', auth, (c) => {
    const userId = c.get('userId');
    const req = getActiveRequest(db, userId);
    if (!req) return c.json({ active: null });
    const trip = req.trip_id ? getTrip(db, req.trip_id) : null;
    return c.json({
      active: {
        request: req,
        trip: trip ? tripWithContactDriver(trip) : null,
      },
    });
  });

  app.post('/rider/cancel', auth, (c) => {
    const userId = c.get('userId');
    const req = getActiveRequest(db, userId);
    if (!req) return c.json({ error: 'no_active_request' }, 404);
    const tx = db.transaction(() => {
      if (req.trip_id && (req.status === 'matched' || req.status === 'in_progress')) {
        db.prepare(
          `UPDATE trips SET seats_available = seats_available + ? WHERE id = ?`,
        ).run(req.seats, req.trip_id);
      }
      db.prepare(`UPDATE requests SET status = 'cancelled' WHERE id = ?`).run(req.id);
    });
    tx();
    return c.json({ ok: true });
  });

  // ---------- Driver ----------
  app.post('/driver/trip', auth, async (c) => {
    const userId = c.get('userId');
    if (getActiveTrip(db, userId) || getActiveRequest(db, userId)) {
      return c.json({ error: 'already_active' }, 409);
    }
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const { pickup, dropoff, seats } = body as {
      pickup?: { label: string; lat: number; lng: number };
      dropoff?: { label: string; lat: number; lng: number };
      seats?: number;
    };
    if (!pickup || !dropoff || !seats) {
      return c.json({ error: 'missing_fields' }, 400);
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      return c.json({ error: 'invalid_seats' }, 400);
    }
    const tripId = id('trp');
    db.prepare(
      `INSERT INTO trips (id, driver_id, pickup_label, pickup_lat, pickup_lng,
         dropoff_label, dropoff_lat, dropoff_lng, seats_total, seats_available, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).run(
      tripId,
      userId,
      pickup.label,
      pickup.lat,
      pickup.lng,
      dropoff.label,
      dropoff.lat,
      dropoff.lng,
      seats,
      seats,
      Date.now(),
    );
    return c.json({ trip: getTrip(db, tripId) }, 201);
  });

  app.get('/driver/requests', auth, (c) => {
    const userId = c.get('userId');
    const trip = getActiveTrip(db, userId);
    if (!trip) return c.json({ error: 'no_active_trip' }, 404);
    const pending = db
      .prepare(
        `SELECT * FROM requests WHERE status = 'pending' AND seats <= ? ORDER BY created_at ASC`,
      )
      .all(trip.seats_available) as RequestRow[];
    const scored = pending
      .map((r) => ({
        request: requestWithPublicRider(r),
        score: scoreTripForRequest(trip, r),
      }))
      .sort((a, b) => a.score - b.score);
    return c.json({ trip, requests: scored });
  });

  app.post('/driver/accept', auth, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => null);
    const reqId = (body as { request_id?: string } | null)?.request_id;
    if (!reqId) return c.json({ error: 'missing_request_id' }, 400);
    const trip = getActiveTrip(db, userId);
    if (!trip || trip.status !== 'active') {
      return c.json({ error: 'no_active_trip' }, 409);
    }
    const req = db
      .prepare('SELECT * FROM requests WHERE id = ?')
      .get(reqId) as RequestRow | undefined;
    if (!req) return c.json({ error: 'request_not_found' }, 404);
    if (req.status !== 'pending') return c.json({ error: 'request_not_pending' }, 409);
    if (req.seats > trip.seats_available) return c.json({ error: 'not_enough_seats' }, 409);
    let success = false;
    const tx = db.transaction(() => {
      const r = db
        .prepare(
          `UPDATE trips SET seats_available = seats_available - ?
           WHERE id = ? AND status = 'active' AND seats_available >= ?`,
        )
        .run(req.seats, trip.id, req.seats);
      if (r.changes === 1) {
        // Re-check the request hasn't been matched concurrently.
        const upd = db
          .prepare(
            `UPDATE requests SET trip_id = ?, status = 'matched' WHERE id = ? AND status = 'pending'`,
          )
          .run(trip.id, req.id);
        if (upd.changes === 1) {
          success = true;
        } else {
          // Roll back the seat decrement.
          db.prepare(
            `UPDATE trips SET seats_available = seats_available + ? WHERE id = ?`,
          ).run(req.seats, trip.id);
        }
      }
    });
    tx();
    if (!success) return c.json({ error: 'request_already_matched' }, 409);
    return c.json({
      trip: getTrip(db, trip.id),
      request: db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id),
    });
  });

  app.post('/driver/start', auth, (c) => {
    const userId = c.get('userId');
    const trip = getActiveTrip(db, userId);
    if (!trip || trip.status !== 'active') return c.json({ error: 'no_active_trip' }, 409);
    const matched = getRequestsForTrip(db, trip.id).filter((r) => r.status === 'matched');
    if (matched.length === 0) return c.json({ error: 'no_passengers' }, 409);
    const tx = db.transaction(() => {
      db.prepare(`UPDATE trips SET status = 'in_progress' WHERE id = ?`).run(trip.id);
      db.prepare(
        `UPDATE requests SET status = 'in_progress' WHERE trip_id = ? AND status = 'matched'`,
      ).run(trip.id);
    });
    tx();
    return c.json({ trip: getTrip(db, trip.id) });
  });

  app.post('/driver/complete', auth, (c) => {
    const userId = c.get('userId');
    const trip = getActiveTrip(db, userId);
    if (!trip || trip.status !== 'in_progress') {
      return c.json({ error: 'trip_not_in_progress' }, 409);
    }
    const tx = db.transaction(() => {
      db.prepare(`UPDATE trips SET status = 'completed' WHERE id = ?`).run(trip.id);
      db.prepare(
        `UPDATE requests SET status = 'completed' WHERE trip_id = ? AND status = 'in_progress'`,
      ).run(trip.id);
    });
    tx();
    return c.json({ trip: getTrip(db, trip.id) });
  });

  app.post('/driver/cancel', auth, (c) => {
    const userId = c.get('userId');
    const trip = getActiveTrip(db, userId);
    if (!trip) return c.json({ error: 'no_active_trip' }, 404);
    const tx = db.transaction(() => {
      db.prepare(`UPDATE trips SET status = 'cancelled' WHERE id = ?`).run(trip.id);
      db.prepare(
        `UPDATE requests SET status = 'cancelled' WHERE trip_id = ? AND status IN ('matched','in_progress')`,
      ).run(trip.id);
    });
    tx();
    return c.json({ ok: true });
  });

  app.get('/driver/active', auth, (c) => {
    const userId = c.get('userId');
    const trip = getActiveTrip(db, userId);
    if (!trip) return c.json({ active: null });
    const requests = getRequestsForTrip(db, trip.id).map(requestWithContactRider);
    return c.json({ active: { trip, requests } });
  });

  // ---------- Shared ----------
  app.get('/rides/history', auth, (c) => {
    const userId = c.get('userId');
    const myRequests = db
      .prepare(
        `SELECT * FROM requests WHERE rider_id = ? AND status IN ('completed','cancelled') ORDER BY created_at DESC LIMIT 50`,
      )
      .all(userId) as RequestRow[];
    const myTrips = db
      .prepare(
        `SELECT * FROM trips WHERE driver_id = ? AND status IN ('completed','cancelled') ORDER BY created_at DESC LIMIT 50`,
      )
      .all(userId) as TripRow[];
    const items = [
      ...myRequests.map((r) => ({
        kind: 'rider' as const,
        id: r.id,
        trip_id: r.trip_id,
        pickup_label: r.pickup_label,
        dropoff_label: r.dropoff_label,
        seats: r.seats,
        fare: r.fare,
        status: r.status,
        created_at: r.created_at,
        trip: r.trip_id ? getTrip(db, r.trip_id) : null,
      })),
      ...myTrips.map((t) => {
        // Cancelled riders never paid — exclude them from earnings and
        // headcount (matches what the live ActiveRide screen shows).
        const reqs = getRequestsForTrip(db, t.id).filter((x) => x.status !== 'cancelled');
        const earnings = reqs.reduce((s, x) => s + x.fare, 0);
        return {
          kind: 'driver' as const,
          id: t.id,
          trip_id: t.id,
          pickup_label: t.pickup_label,
          dropoff_label: t.dropoff_label,
          seats: t.seats_total,
          fare: +earnings.toFixed(2),
          status: t.status,
          created_at: t.created_at,
          passenger_count: reqs.length,
        };
      }),
    ].sort((a, b) => b.created_at - a.created_at);
    return c.json({ history: items });
  });

  // ---------- Public profiles + ratings ----------
  // Profile summary callers ask for the variant they're allowed to see.
  function profileSummary(userId: string, viewerId: string): ProfileSummary | null {
    const u = loadUserRow(db, userId);
    if (!u) return null;
    const agg = db
      .prepare('SELECT AVG(stars) AS avg, COUNT(*) AS count FROM ratings WHERE ratee_id = ?')
      .get(userId) as { avg: number | null; count: number };
    const ridesAsRider = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM requests WHERE rider_id = ? AND status = 'completed'`,
        )
        .get(userId) as { c: number }
    ).c;
    const ridesAsDriver = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM trips WHERE driver_id = ? AND status = 'completed'`,
        )
        .get(userId) as { c: number }
    ).c;
    // Contact info is only attached when the viewer is the user themselves
    // or when they share a trip (handled by callers via `attachContact`).
    const base: ProfileSummary = {
      ...publicUser(u),
      rating_avg: agg.avg !== null ? +agg.avg.toFixed(2) : null,
      rating_count: agg.count,
      rides_as_rider: ridesAsRider,
      rides_as_driver: ridesAsDriver,
    };
    if (viewerId === userId) {
      base.email = u.email;
      base.phone = u.phone;
    }
    return base;
  }

  function attachContact(profile: ProfileSummary, userId: string): ProfileSummary {
    const u = loadUserRow(db, userId);
    if (!u) return profile;
    return { ...profile, email: u.email, phone: u.phone };
  }

  app.get('/users/:id', auth, (c) => {
    const viewerId = c.get('userId');
    const target = c.req.param('id');
    const profile = profileSummary(target, viewerId);
    if (!profile) return c.json({ error: 'user_not_found' }, 404);
    return c.json({ profile });
  });

  // Returns the full participant set. When the trip is `completed`, only
  // riders who actually completed the trip are included (cancelled and
  // never-matched requests are filtered out — they didn't ride).
  function tripParticipants(tripId: string): {
    trip: TripRow;
    driver: PublicUser;
    riders: { user: PublicUser; request: RequestRow }[];
  } | null {
    const trip = getTrip(db, tripId);
    if (!trip) return null;
    const driver = loadPublicUser(db, trip.driver_id);
    if (!driver) return null;
    const completedOnly = trip.status === 'completed';
    const riders = getRequestsForTrip(db, tripId)
      .filter((r) =>
        completedOnly ? r.status === 'completed' : r.status !== 'cancelled',
      )
      .map((r) => {
        const user = loadPublicUser(db, r.rider_id);
        return user ? { user, request: r } : null;
      })
      .filter((x): x is { user: PublicUser; request: RequestRow } => x !== null);
    return { trip, driver, riders };
  }

  function isParticipant(tripId: string, userId: string): boolean {
    const trip = getTrip(db, tripId);
    if (!trip) return false;
    if (trip.driver_id === userId) return true;
    const r = db
      .prepare(
        `SELECT id FROM requests WHERE trip_id = ? AND rider_id = ? AND status != 'cancelled'`,
      )
      .get(tripId, userId);
    return !!r;
  }

  app.get('/rides/:tripId/participants', auth, (c) => {
    const userId = c.get('userId');
    const tripId = c.req.param('tripId');
    if (!isParticipant(tripId, userId)) {
      return c.json({ error: 'not_a_participant' }, 403);
    }
    const data = tripParticipants(tripId);
    if (!data) return c.json({ error: 'trip_not_found' }, 404);
    // Co-participants get contact info — they share or shared a trip.
    const driverProfile = attachContact(profileSummary(data.driver.id, userId)!, data.driver.id);
    const riders = data.riders.map((r) => ({
      profile: attachContact(profileSummary(r.user.id, userId)!, r.user.id),
      request: r.request,
    }));
    return c.json({ trip: data.trip, driver: driverProfile, riders });
  });

  function completedParticipantIds(tripId: string): {
    driverId: string | null;
    riderIds: string[];
  } {
    const trip = getTrip(db, tripId);
    if (!trip || trip.status !== 'completed') return { driverId: null, riderIds: [] };
    const riderIds = (
      db
        .prepare(
          `SELECT rider_id FROM requests WHERE trip_id = ? AND status = 'completed'`,
        )
        .all(tripId) as { rider_id: string }[]
    ).map((r) => r.rider_id);
    return { driverId: trip.driver_id, riderIds };
  }

  app.post('/rides/:tripId/ratings', auth, async (c) => {
    const userId = c.get('userId');
    const tripId = c.req.param('tripId');
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const { ratee_id, stars, comment } = body as {
      ratee_id?: string;
      stars?: number;
      comment?: string;
    };
    if (!ratee_id || typeof stars !== 'number') {
      return c.json({ error: 'missing_fields' }, 400);
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return c.json({ error: 'invalid_stars' }, 400);
    }
    if (ratee_id === userId) return c.json({ error: 'cannot_rate_self' }, 400);

    const { driverId, riderIds } = completedParticipantIds(tripId);
    if (!driverId) return c.json({ error: 'trip_not_completed' }, 409);
    const allCompleted = new Set([driverId, ...riderIds]);
    if (!allCompleted.has(userId)) {
      return c.json({ error: 'not_a_completed_participant' }, 403);
    }
    if (!allCompleted.has(ratee_id)) {
      return c.json({ error: 'ratee_not_a_completed_participant' }, 400);
    }
    const dup = db
      .prepare(
        `SELECT id FROM ratings WHERE trip_id = ? AND rater_id = ? AND ratee_id = ?`,
      )
      .get(tripId, userId, ratee_id);
    if (dup) return c.json({ error: 'already_rated' }, 409);

    const ratingId = id('rat');
    db.prepare(
      `INSERT INTO ratings (id, trip_id, rater_id, ratee_id, stars, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      ratingId,
      tripId,
      userId,
      ratee_id,
      stars,
      typeof comment === 'string' ? comment.trim() || null : null,
      Date.now(),
    );
    const rating = db
      .prepare('SELECT * FROM ratings WHERE id = ?')
      .get(ratingId) as RatingRow;
    return c.json({ rating }, 201);
  });

  app.get('/rides/:tripId/ratings', auth, (c) => {
    const userId = c.get('userId');
    const tripId = c.req.param('tripId');
    if (!isParticipant(tripId, userId)) {
      return c.json({ error: 'not_a_participant' }, 403);
    }
    const submitted = db
      .prepare(
        `SELECT * FROM ratings WHERE trip_id = ? AND rater_id = ? ORDER BY created_at ASC`,
      )
      .all(tripId, userId) as RatingRow[];
    const received = db
      .prepare(
        `SELECT * FROM ratings WHERE trip_id = ? AND ratee_id = ? ORDER BY created_at ASC`,
      )
      .all(tripId, userId) as RatingRow[];
    return c.json({ submitted, received });
  });

  return { app, db };
}
