import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { sql, TEST_MODE } from './db.js';

const PASSWORD = process.env.GAMENIGHT_PASSWORD ?? '';
if (!PASSWORD && !TEST_MODE) {
  throw new Error('Set GAMENIGHT_PASSWORD before starting the server.');
}
const TOKEN_DAYS = 30;

// Brute-force protection, stored in the database so every Vercel instance shares the same counts.
const WINDOW_MINUTES = 15;
const MAX_PER_IP = 10;      // wrong guesses from one address per window
const MAX_OVERALL = 100;    // wrong guesses from everyone per window, so rotating addresses doesn't help

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const hex = (s: string) => sha256(s).toString('hex');

// Tokens are stored hashed, so a leaked database doesn't hand out logins. Each token also
// remembers which password it was issued under: changing GAMENIGHT_PASSWORD logs everyone out.
const PASSWORD_TAG = hex(`gamenight:${PASSWORD}`).slice(0, 16);

// On Vercel the visitor's address is in x-real-ip (set by Vercel, not the browser).
function clientIp(req: Request) {
  const real = process.env.VERCEL ? req.headers['x-real-ip'] : undefined;
  return (Array.isArray(real) ? real[0] : real) ?? req.socket.remoteAddress ?? 'unknown';
}

export async function login(req: Request, res: Response) {
  const ip = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const [{ mine, overall }] = await sql<{ mine: number; overall: number }[]>`
    SELECT count(*) FILTER (WHERE ip = ${ip})::int AS mine, count(*)::int AS overall
    FROM login_attempts WHERE at > ${since}`;
  if (mine >= MAX_PER_IP || overall >= MAX_OVERALL) {
    return res.status(429).json({ error: `Too many wrong passwords. Try again in ${WINDOW_MINUTES} minutes.` });
  }
  if (!timingSafeEqual(sha256(String(req.body?.password ?? '')), sha256(PASSWORD))) {
    await sql`INSERT INTO login_attempts (ip, at) VALUES (${ip}, ${new Date().toISOString()})`;
    return res.status(401).json({ error: 'Wrong password.' });
  }
  await sql`DELETE FROM login_attempts WHERE ip = ${ip} OR at <= ${since}`;
  // Tidy up: drop expired logins.
  await sql`DELETE FROM auth_tokens WHERE created_at <= ${new Date(Date.now() - TOKEN_DAYS * 86_400_000).toISOString()}`;
  const token = randomBytes(32).toString('hex');
  await sql`INSERT INTO auth_tokens (token, created_at, password_tag) VALUES (${hex(token)}, ${new Date().toISOString()}, ${PASSWORD_TAG})`;
  res.json({ token });
}

const bearer = (req: Request) => req.headers.authorization?.replace(/^Bearer /, '') || null;

export async function logout(req: Request, res: Response) {
  const token = bearer(req);
  if (token) await sql`DELETE FROM auth_tokens WHERE token = ${hex(token)}`;
  res.json({ ok: true });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Test mode only listens on this computer (and can't run on Vercel, see db.ts), so no password is needed.
  if (TEST_MODE) return next();
  const token = bearer(req);
  const cutoff = new Date(Date.now() - TOKEN_DAYS * 86_400_000).toISOString();
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  let ok = (await sql`SELECT 1 FROM auth_tokens
    WHERE token = ${hex(token)} AND password_tag = ${PASSWORD_TAG} AND created_at > ${cutoff}`).length > 0;
  if (!ok) {
    // Logins from before tokens were hashed: upgrade in place so nobody is logged out.
    ok = (await sql`UPDATE auth_tokens SET token = ${hex(token)}, password_tag = ${PASSWORD_TAG}
      WHERE token = ${token} AND password_tag IS NULL AND created_at > ${cutoff} RETURNING 1`).length > 0;
  }
  if (!ok) return res.status(401).json({ error: 'Please log in.' });
  next();
}
