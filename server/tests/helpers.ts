import type { Hono } from 'hono';
import { createApp } from '../src/app.js';

export function makeApp() {
  return createApp({ dbPath: ':memory:', secret: 'test-secret' });
}

export const PLACES = {
  home: { label: 'Home', lat: 37.7749, lng: -122.4194 },
  work: { label: 'Work', lat: 37.7858, lng: -122.4065 },
  gym: { label: 'Gym', lat: 37.7694, lng: -122.4862 },
  airport: { label: 'Airport (SFO)', lat: 37.6213, lng: -122.379 },
  university: { label: 'University', lat: 37.8719, lng: -122.2585 },
};

type Json = unknown;

export async function call(
  app: Hono<any, any, any>,
  method: string,
  path: string,
  body?: Json,
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
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

export async function createUser(
  app: Hono<any, any, any>,
  email: string,
  password = 'hunter22',
  name = 'Test User',
  phone = '555-0100',
): Promise<{ token: string; user: any }> {
  const res = await call(app, 'POST', '/auth/signup', {
    name,
    email,
    phone,
    password,
  });
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}
