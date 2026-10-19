import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db.js';
import { eventHub } from './lib/realtime.js';

const server = serve({ fetch: createApp().fetch, port: env.API_PORT }, (info) => {
  console.log(`✔ API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

// Di belakang proxy (Next rewrites, load balancer) socket keep-alive dipakai ulang.
// Default Node (5s) bisa menutup socket tepat saat proxy mengirim request → ECONNRESET.
// Timeout server harus lebih lama dari idle timeout proxy.
if ('keepAliveTimeout' in server) {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} diterima, menutup server...`);
  server.close();
  await eventHub.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
