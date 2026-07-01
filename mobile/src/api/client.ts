/**
 * Thin fetch wrapper around the read-side API.
 *
 * All calls go through `fetchJson` — it throws `ApiError` on any non-2xx,
 * so screens don't have to hand-code status checks. It also captures the
 * `X-Data-Source` response header on every successful call; DevModeBanner
 * reads from the tiny shared subscription below to show/hide the dev strip.
 */

import { API_BASE_URL } from './config';

export type DataSource = 'synthetic' | 'real' | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ─── Cross-hook data-source signal ───────────────────────────────────────────
// A minimal pub/sub keeps the dev banner accurate without dragging in a full
// state library. Every successful response updates the current value; the
// banner subscribes and re-renders.

let currentDataSource: DataSource = 'unknown';
const listeners = new Set<(v: DataSource) => void>();

export function getDataSource(): DataSource {
  return currentDataSource;
}

export function subscribeDataSource(cb: (v: DataSource) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setDataSource(value: DataSource): void {
  if (value === currentDataSource) return;
  currentDataSource = value;
  for (const cb of listeners) cb(value);
}

// ─── Core fetch helper ───────────────────────────────────────────────────────

export async function fetchJson<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url);

  const header = res.headers.get('X-Data-Source') ?? res.headers.get('x-data-source');
  if (header === 'synthetic' || header === 'real') {
    setDataSource(header);
  }

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // swallow — body read failure is not more useful than the status.
    }
    throw new ApiError(`GET ${path} failed (${res.status}): ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}
