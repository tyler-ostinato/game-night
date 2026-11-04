// Local dev server. On Vercel, api/index.ts serves the same app.
import './env.js';
import app, { TEST_MODE } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, TEST_MODE ? '127.0.0.1' : '0.0.0.0', () =>
  console.log(`API on http://localhost:${PORT}${TEST_MODE ? ' (TEST MODE - using TEST_DATABASE_URL, no password)' : ''}`));
