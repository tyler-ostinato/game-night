// Game cover images: copied into Vercel Blob (never hot-linked), so links can't go stale.
import express from 'express';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { del, put } from '@vercel/blob';
import { sql } from './db.js';
import { requireAuth } from './auth.js';

// Test mode keeps its uploads in their own folder of the store.
const FOLDER = process.env.GAMENIGHT_TEST === '1' ? 'test-covers' : 'covers';
// Prefer the store's read-write token when there is one; otherwise @vercel/blob falls back to Vercel's OIDC login.
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const BGG_TOKEN = process.env.BGG_TOKEN;

// Messages that are safe to show the user. Anything else is reported as a generic failure.
class UserError extends Error {}

// Addresses a cover link may never point at: this computer, private networks, cloud metadata, etc.
const PRIVATE = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]] as const) PRIVATE.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) PRIVATE.addSubnet(net, bits, 'ipv6');

function isPrivate(address: string) {
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]; // IPv4 written as IPv6
  return v4 ? PRIVATE.check(v4, 'ipv4') : PRIVATE.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UserError('Image link must start with http:// or https://');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map(a => a.address);
  if (!addresses.length) throw new UserError("Couldn't find that website.");
  if (addresses.some(isPrivate)) throw new UserError("That link points to a private address, which isn't allowed.");
}

async function download(link: string): Promise<{ type: string; data: Buffer }> {
  let url: URL;
  try { url = new URL(link); } catch { throw new UserError('That is not a valid link.'); }
  // Follow redirects by hand so every hop is checked, not just the first.
  let res: Response;
  for (let hop = 0; ; hop++) {
    await assertPublic(url);
    res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) }).catch(() => {
      throw new UserError("Couldn't download that image.");
    });
    const next = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !next) break;
    if (hop >= 4) throw new UserError('That link redirects too many times.');
    url = new URL(next, url);
  }
  if (!res.ok) throw new UserError(`Couldn't download that image (HTTP ${res.status}).`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!TYPES[type]) throw new UserError('That link is not a JPG, PNG, WebP, GIF or AVIF image.');
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new UserError('Image is over 5 MB.');
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > MAX_BYTES) throw new UserError('Image is over 5 MB.');
  return { type, data };
}

function fromDataUrl(dataUrl: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TYPES[m[1]]) throw new UserError('Upload a JPG, PNG, WebP, GIF or AVIF image.');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > MAX_BYTES) throw new UserError('Image is over 5 MB.');
  return { type: m[1], data };
}

export async function removeImage(gameId: number) {
  const [row] = await sql`SELECT image FROM games WHERE id = ${gameId}`;
  // Only delete files from this mode's own folder. The test database is a copy of production,
  // so its games point at real covers, and those must never be deleted from testing mode.
  if (row?.image && new URL(row.image).pathname.startsWith(`/${FOLDER}/`)) await del(row.image, { token: BLOB_TOKEN });
}

async function bgg(pathAndQuery: string): Promise<string> {
  const res = await fetch(`https://boardgamegeek.com/xmlapi2/${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${BGG_TOKEN}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new UserError(`BoardGameGeek answered HTTP ${res.status}.`);
  return res.text();
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export const imageRoutes = express.Router();

// Body: { url } to download from a link, { dataUrl } for an upload, or { bggId } to use BoardGameGeek's cover.
imageRoutes.put('/games/:id/image', requireAuth, express.json({ limit: '8mb' }), async (req, res) => {
  const gameId = Number(req.params.id);
  if (!(await sql`SELECT 1 FROM games WHERE id = ${gameId}`).length) return res.status(404).json({ error: 'Game not found.' });
  try {
    let image;
    if (req.body?.dataUrl) image = fromDataUrl(String(req.body.dataUrl));
    else if (req.body?.url) image = await download(String(req.body.url).trim());
    else if (req.body?.bggId && BGG_TOKEN) {
      const xml = await bgg(`thing?id=${Number(req.body.bggId)}`);
      const url = /<image>\s*([^<]+?)\s*<\/image>/.exec(xml)?.[1];
      if (!url) throw new UserError('That BoardGameGeek entry has no cover image.');
      image = await download(decode(url));
    } else return res.status(400).json({ error: 'Give an image link or upload a file.' });

    await removeImage(gameId);
    // Random suffix so browsers don't show a cached old cover.
    const { url } = await put(`${FOLDER}/${gameId}.${TYPES[image.type]}`, image.data,
      { access: 'public', contentType: image.type, addRandomSuffix: true, token: BLOB_TOKEN });
    await sql`UPDATE games SET image = ${url} WHERE id = ${gameId}`;
    res.json({ image: url });
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    res.status(400).json({ error: err instanceof UserError ? err.message : 'Saving the cover failed. Please try again.' });
  }
});

imageRoutes.delete('/games/:id/image', requireAuth, async (req, res) => {
  await removeImage(Number(req.params.id));
  await sql`UPDATE games SET image = NULL WHERE id = ${Number(req.params.id)}`;
  res.json({ ok: true });
});

imageRoutes.get('/bgg/search', requireAuth, async (req, res) => {
  if (!BGG_TOKEN) return res.status(400).json({ error: 'BoardGameGeek search needs a BGG_TOKEN on the server.' });
  try {
    const xml = await bgg(`search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(String(req.query.q ?? ''))}`);
    const items = [...xml.matchAll(/<item type="(\w+)" id="(\d+)">([\s\S]*?)<\/item>/g)].slice(0, 12).map(([, type, id, body]) => ({
      id: Number(id), type,
      name: decode(/<name type="primary" value="([^"]*)"/.exec(body)?.[1] ?? /<name [^>]*value="([^"]*)"/.exec(body)?.[1] ?? '?'),
      year: /<yearpublished value="(\d+)"/.exec(body)?.[1] ?? null,
    }));
    res.json(items);
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    res.status(502).json({ error: err instanceof UserError ? err.message : 'BoardGameGeek search failed. Please try again.' });
  }
});

export const bggEnabled = () => !!BGG_TOKEN;
