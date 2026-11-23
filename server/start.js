import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openCapsules } from './capsules.js';

const { APP_URL, RENDER_EXTERNAL_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET } = process.env;
const port = Number(process.env.PORT ?? 3000);
const appUrl = new URL(APP_URL || RENDER_EXTERNAL_URL || `http://localhost:${port}`);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 bytes. See the README.');
}
if (appUrl.protocol !== 'https:' && appUrl.origin !== `http://localhost:${port}`) {
  throw new Error('APP_URL must use HTTPS, or http://localhost with the local PORT.');
}
if (Boolean(GITHUB_CLIENT_ID) !== Boolean(GITHUB_CLIENT_SECRET) ||
    (process.env.NODE_ENV === 'production' && !GITHUB_CLIENT_ID)) {
  throw new Error('Set both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
}
if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
  throw new Error('Run npm run build before starting AI Capsule.');
}

const { db, statements } = openCapsules(process.env.DATABASE_PATH || './data/capsules.db');
const app = createApp({
  statements,
  dist,
  origin: appUrl.origin,
  clientId: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  jwtSecret: JWT_SECRET,
});
const host = appUrl.protocol === 'http:' ? 'localhost' : '0.0.0.0';
const server = app.listen(port, host, () => console.log(`AI Capsule · ${appUrl.origin}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => db.close()));
}
