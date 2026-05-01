import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Context, MiddlewareHandler } from 'hono';
import type { DB } from './db.js';
import type { PublicUser, UserRow } from './types.js';

export type AuthVars = {
  userId: string;
  user: PublicUser;
};

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    vehicle: u.vehicle,
    seats: u.seats,
    bio: u.bio,
  };
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function signToken(secret: string, userId: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '30d' });
}

export function verifyToken(secret: string, token: string): string | null {
  try {
    const decoded = jwt.verify(token, secret) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

export function authMiddleware(db: DB, secret: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const token = header.slice(7);
    const userId = verifyToken(secret, token);
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    const row = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow | undefined;
    if (!row) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', row.id);
    c.set('user', publicUser(row));
    await next();
  };
}
