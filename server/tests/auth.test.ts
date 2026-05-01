import { describe, expect, it } from 'vitest';
import { call, createUser, makeApp } from './helpers.js';

describe('auth', () => {
  it('signs up a new user and returns a token', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/auth/signup', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0101',
      password: 'analytical-engine',
    });
    expect(res.status).toBe(201);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user.email).toBe('ada@example.com');
    expect(res.data.user.password_hash).toBeUndefined();
  });

  it('rejects signup with missing fields', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/auth/signup', {
      email: 'x@x.com',
      password: 'short1',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('missing_fields');
  });

  it('rejects signup with a short password', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/auth/signup', {
      name: 'X',
      email: 'x@x.com',
      phone: '555',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('password_too_short');
  });

  it('rejects duplicate email', async () => {
    const { app } = makeApp();
    await createUser(app, 'dup@example.com');
    const res = await call(app, 'POST', '/auth/signup', {
      name: 'X',
      email: 'dup@example.com',
      phone: '555',
      password: 'hunter22',
    });
    expect(res.status).toBe(409);
    expect(res.data.error).toBe('email_taken');
  });

  it('signs in with correct credentials', async () => {
    const { app } = makeApp();
    await createUser(app, 'login@example.com', 'mypw1234');
    const res = await call(app, 'POST', '/auth/signin', {
      email: 'login@example.com',
      password: 'mypw1234',
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
  });

  it('rejects signin with wrong password', async () => {
    const { app } = makeApp();
    await createUser(app, 'wrong@example.com', 'correct1');
    const res = await call(app, 'POST', '/auth/signin', {
      email: 'wrong@example.com',
      password: 'incorrect',
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe('invalid_credentials');
  });

  it('rejects signin for unknown email', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/auth/signin', {
      email: 'nobody@example.com',
      password: 'whatever1',
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe('invalid_credentials');
  });

  it('returns the current user with /me', async () => {
    const { app } = makeApp();
    const { token } = await createUser(app, 'me@example.com');
    const res = await call(app, 'GET', '/me', undefined, token);
    expect(res.status).toBe(200);
    expect(res.data.user.email).toBe('me@example.com');
  });

  it('rejects /me without a token', async () => {
    const { app } = makeApp();
    const res = await call(app, 'GET', '/me');
    expect(res.status).toBe(401);
    expect(res.data.error).toBe('unauthorized');
  });

  it('rejects /me with a malformed token', async () => {
    const { app } = makeApp();
    const res = await call(app, 'GET', '/me', undefined, 'not-a-token');
    expect(res.status).toBe(401);
    expect(res.data.error).toBe('unauthorized');
  });

  it('updates profile via PATCH /me', async () => {
    const { app } = makeApp();
    const { token } = await createUser(app, 'driver@example.com');
    const res = await call(
      app,
      'PATCH',
      '/me',
      { vehicle: 'Tesla Model 3 (White)', seats: 4 },
      token,
    );
    expect(res.status).toBe(200);
    expect(res.data.user.vehicle).toBe('Tesla Model 3 (White)');
    expect(res.data.user.seats).toBe(4);
  });

  it('clamps absurd seat counts on PATCH /me', async () => {
    const { app } = makeApp();
    const { token } = await createUser(app, 'big@example.com');
    const res = await call(app, 'PATCH', '/me', { seats: 500 }, token);
    expect(res.status).toBe(200);
    expect(res.data.user.seats).toBeLessThanOrEqual(7);
  });
});
