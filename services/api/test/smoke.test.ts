import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(join(__dirname, '..', '..', 'pipeline', 'data'));

let app: FastifyInstance;

before(async () => {
  app = buildApp({
    config: {
      port: 0,
      data_dir: DATA_DIR,
      data_source: 'synthetic',
      log_level: 'warn',
    },
  });
  await app.ready();
});

after(async () => {
  await app.close();
});

describe('smoke: health + envelope', () => {
  test('root responds with entity counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { status: string; entities: Record<string, number> };
    assert.equal(body.status, 'ok');
    assert.ok(body.entities.competitions === 5);
    assert.ok(body.entities.teams === 28);
  });

  test('every response carries X-Data-Source: synthetic', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitions' });
    assert.equal(res.headers['x-data-source'], 'synthetic');
  });
});

describe('smoke: competitions + seasons', () => {
  test('competitions list', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitions' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as unknown[];
    assert.equal(body.length, 5);
  });

  test('one competition', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitions/six-nations' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { id: string; format: string };
    assert.equal(body.id, 'six-nations');
    assert.equal(body.format, 'round-robin');
  });

  test('seasons filtered by competition_id', async () => {
    const res = await app.inject({
      method: 'GET', url: '/seasons?competition_id=world-cup',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { id: string; competition_id: string }[];
    assert.equal(body.length, 1);
    assert.equal(body[0]?.competition_id, 'world-cup');
  });

  test('404 for unknown competition', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitions/nope' });
    assert.equal(res.statusCode, 404);
  });
});

describe('smoke: fixtures + standings', () => {
  test('Six Nations 2026 fixtures = 15', async () => {
    const res = await app.inject({
      method: 'GET', url: '/seasons/six-nations-2026/fixtures',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as unknown[];
    assert.equal(body.length, 15);
  });

  test('Six Nations 2026 standings = 1 table, 6 rows', async () => {
    const res = await app.inject({
      method: 'GET', url: '/seasons/six-nations-2026/standings',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { group: string | null; rows: unknown[] }[];
    assert.equal(body.length, 1);
    assert.equal(body[0]?.rows.length, 6);
  });

  test('RWC 2027 standings = 6 per-pool tables', async () => {
    const res = await app.inject({
      method: 'GET', url: '/seasons/world-cup-2027/standings',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { group: string | null }[];
    assert.equal(body.length, 6);
    assert.ok(body.every((s) => s.group?.startsWith('Pool') === true));
  });

  test('RWC 2027 bracket has 5 rounds', async () => {
    const res = await app.inject({
      method: 'GET', url: '/seasons/world-cup-2027/bracket',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { rounds: unknown[] };
    assert.equal(body.rounds.length, 5);
  });

  test('fixture drill-down + result + lineups', async () => {
    const fxRes = await app.inject({
      method: 'GET', url: '/fixtures/sn26-r1-fra-ita',
    });
    assert.equal(fxRes.statusCode, 200);
    const resultRes = await app.inject({
      method: 'GET', url: '/fixtures/sn26-r1-fra-ita/result',
    });
    assert.equal(resultRes.statusCode, 200);
    const lineupsRes = await app.inject({
      method: 'GET', url: '/fixtures/sn26-r1-fra-ita/lineups',
    });
    assert.equal(lineupsRes.statusCode, 200);
    assert.equal((lineupsRes.json() as unknown[]).length, 2);
  });

  test('scheduled fixture has no result yet (404)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/fixtures/rc26-r1-nzl-arg/result',
    });
    assert.equal(res.statusCode, 404);
  });
});

describe('smoke: teams + squads + rankings', () => {
  test('all teams = 28 (Tier 1 + Tier 2)', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as unknown[];
    assert.equal(body.length, 28);
  });

  test('team drill-down includes chronologically-sorted fixtures', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams/ire' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { id: string; fixtures: { kickoff_utc: string }[] };
    assert.equal(body.id, 'ire');
    assert.ok(body.fixtures.length > 0);
    for (let i = 1; i < body.fixtures.length; i++) {
      const prev = body.fixtures[i - 1]!.kickoff_utc;
      const curr = body.fixtures[i]!.kickoff_utc;
      assert.ok(prev <= curr, 'fixtures not sorted');
    }
  });

  test('squad requires season_id (400 without)', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams/ire/squad' });
    assert.equal(res.statusCode, 400);
  });

  test('squad returns 33-player roster', async () => {
    const res = await app.inject({
      method: 'GET', url: '/teams/ire/squad?season_id=six-nations-2026',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { players: unknown[] };
    assert.equal(body.players.length, 33);
  });

  test('latest ranking has all 28 teams', async () => {
    const res = await app.inject({ method: 'GET', url: '/rankings' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { rows: unknown[] };
    assert.equal(body.rows.length, 28);
  });

  test('rankings history returns all snapshots', async () => {
    const res = await app.inject({ method: 'GET', url: '/rankings/history' });
    const body = res.json() as unknown[];
    assert.equal(body.length, 3);
  });
});
