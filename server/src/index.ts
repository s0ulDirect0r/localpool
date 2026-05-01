import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const dbPath = process.env.DB_PATH ?? './localpool.db';
const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';

const { app } = createApp({ dbPath, secret });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LocalPool API listening on http://localhost:${info.port}`);
});
