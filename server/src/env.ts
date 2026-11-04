// Local settings pulled with `vercel env pull` (see README). Import this first.
import { existsSync } from 'node:fs';

const envFile = new URL('../../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
