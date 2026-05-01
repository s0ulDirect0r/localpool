import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? '0.0.0.0';
const dbPath = process.env.DB_PATH ?? './localpool.db';
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 16) {
  console.error(
    'JWT_SECRET environment variable is required and must be at least 16 characters.',
  );
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const { app } = createApp({ dbPath, secret });

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`LocalPool API listening on http://${hostname}:${info.port}`);
});
