import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

const PASSWORD = process.env.GAMENIGHT_PASSWORD ?? '';
if (!PASSWORD && process.env.GAMENIGHT_TEST !== '1') {
  throw new Error('Set GAMENIGHT_PASSWORD before starting the server.');
}
const TOKEN_DAYS = 30;

// Bots get 10 tries per IP every 15 minutes.
const attempts = new Map<string, { count: number; resetAt: number }>();

const hash = (s: string) => createHash('sha256').update(s).digest();

export function login(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.resetAt > now && a.count >= 10) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  if (!timingSafeEqual(hash(String(req.body?.password ?? '')), hash(PASSWORD))) {
    attempts.set(ip, a && a.resetAt > now ? { ...a, count: a.count + 1 } : { count: 1, resetAt: now + 15 * 60_000 });
    return res.status(401).json({ error: 'Wrong password.' });
  }
  attempts.delete(ip);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_tokens (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString());
  res.json({ token });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Test mode only listens on localhost, so no password is needed.
  if (process.env.GAMENIGHT_TEST === '1') return next();
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const cutoff = new Date(Date.now() - TOKEN_DAYS * 86_400_000).toISOString();
  const ok = token && db.prepare('SELECT 1 FROM auth_tokens WHERE token = ? AND created_at > ?').get(token, cutoff);
  if (!ok) return res.status(401).json({ error: 'Please log in.' });
  next();
}
