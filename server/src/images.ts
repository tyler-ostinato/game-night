// Game cover images: copied into Vercel Blob (never hot-linked), so links can't go stale.
import express from 'express';
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

async function download(url: string): Promise<{ type: string; data: Buffer }> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Image link must start with http:// or https://');
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Couldn't download that image (HTTP ${res.status}).`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!TYPES[type]) throw new Error('That link is not a JPG, PNG, WebP, GIF or AVIF image.');
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > MAX_BYTES) throw new Error('Image is over 5 MB.');
  return { type, data };
}

function fromDataUrl(dataUrl: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !TYPES[m[1]]) throw new Error('Upload a JPG, PNG, WebP, GIF or AVIF image.');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > MAX_BYTES) throw new Error('Image is over 5 MB.');
  return { type: m[1], data };
}

export async function removeImage(gameId: number) {
  const [row] = await sql`SELECT image FROM games WHERE id = ${gameId}`;
  if (row?.image) await del(row.image, { token: BLOB_TOKEN });
}

async function bgg(pathAndQuery: string): Promise<string> {
  const res = await fetch(`https://boardgamegeek.com/xmlapi2/${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${BGG_TOKEN}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`BoardGameGeek answered HTTP ${res.status}.`);
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
      if (!url) throw new Error('That BoardGameGeek entry has no cover image.');
      image = await download(decode(url));
    } else return res.status(400).json({ error: 'Give an image link or upload a file.' });

    await removeImage(gameId);
    // Random suffix so browsers don't show a cached old cover.
    const { url } = await put(`${FOLDER}/${gameId}.${TYPES[image.type]}`, image.data,
      { access: 'public', contentType: image.type, addRandomSuffix: true, token: BLOB_TOKEN });
    await sql`UPDATE games SET image = ${url} WHERE id = ${gameId}`;
    res.json({ image: url });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
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
    res.status(502).json({ error: (err as Error).message });
  }
});

export const bggEnabled = () => !!BGG_TOKEN;
