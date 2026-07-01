/**
 * API base URL.
 *
 * Default: the Cloud Run stub. Override with `EXPO_PUBLIC_API_URL` in a
 * `.env` file (or shell env) when developing against the local Fastify
 * server, e.g.:
 *
 *   EXPO_PUBLIC_API_URL=http://localhost:3000
 *
 * The client fetches over the network — even a physical iPhone dev build
 * can hit the public Cloud Run URL without any tunnelling. For localhost
 * during LAN dev, an iOS Simulator uses `http://localhost:PORT` directly;
 * a physical device uses `http://<mac-lan-ip>:PORT`.
 */

const DEFAULT_API_URL = 'https://rugby-api-410011126463.europe-west1.run.app';

export const API_BASE_URL: string =
  process.env['EXPO_PUBLIC_API_URL'] ?? DEFAULT_API_URL;
