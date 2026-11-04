// Copies the real database to data/test.db so test mode starts from today's real data.
import Database from 'better-sqlite3';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

// Replacing test.db under a running test server breaks it, so bail if one is up.
const inUse = await new Promise<boolean>(resolve => {
  const sock = net.connect(3002, '127.0.0.1', () => { sock.end(); resolve(true); });
  sock.on('error', () => resolve(false));
});
if (inUse) {
  console.error('Test mode is already running (port 3002). Stop it first, then run npm run dev:test again.');
  process.exit(1);
}

const real = fileURLToPath(new URL('../../data/gamenight.db', import.meta.url));
const test = fileURLToPath(new URL('../../data/test.db', import.meta.url));

for (const suffix of ['', '-wal', '-shm']) rmSync(test + suffix, { force: true });
await new Database(real, { readonly: true }).backup(test);
// Covers too, so test uploads never touch the real ones.
const images = fileURLToPath(new URL('../../data/images', import.meta.url));
const testImages = fileURLToPath(new URL('../../data/test-images', import.meta.url));
rmSync(testImages, { recursive: true, force: true });
if (existsSync(images)) cpSync(images, testImages, { recursive: true });
console.log('Test database and images reset from real data.');
