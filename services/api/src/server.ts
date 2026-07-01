/**
 * Fastify server entrypoint. Also exports `buildApp` so tests can create an
 * app instance without opening a network port (Fastify's `inject` API).
 */

import Fastify, { type FastifyInstance } from 'fastify';

import { type Config, loadConfig } from './config.js';
import { registerRoutes } from './routes.js';
import { loadStore } from './store.js';

export interface AppOptions {
  config?: Config;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const store = loadStore(config.data_dir);

  const app = Fastify({
    logger: { level: config.log_level },
  });

  // Broadcast the data-source on every response — the mobile client uses this
  // to gate the dev-mode banner (PRD §5.5 dev indicator requirement).
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Data-Source', config.data_source);
  });

  registerRoutes(app, store);

  return app;
}

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('server.ts') === true;

if (isDirectRun) {
  const config = loadConfig();
  const app = buildApp({ config });
  app.listen({ port: config.port, host: '0.0.0.0' }).catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
}
