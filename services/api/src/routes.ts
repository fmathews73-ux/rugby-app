import type { FastifyInstance, FastifyReply } from 'fastify';

import type { Store } from './store.js';

function notFound(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', message });
}

export function registerRoutes(app: FastifyInstance, store: Store): void {
  // ─── Root / health ────────────────────────────────────────────────────────
  app.get('/', async () => ({
    service: '@rugby-app/api',
    status: 'ok',
    entities: {
      competitions: store.competitions.length,
      seasons: store.seasons.length,
      teams: store.teams.length,
      players: store.players.length,
      squads: store.squads.length,
      fixtures: store.fixtures.length,
      results: store.results.length,
      lineups: store.lineups.length,
      standings: store.standings.length,
      brackets: store.brackets.length,
      rankings: store.rankings.length,
    },
  }));

  // ─── Competitions ─────────────────────────────────────────────────────────
  app.get('/competitions', async () => store.competitions);

  app.get<{ Params: { id: string } }>('/competitions/:id', async (req, reply) => {
    const c = store.competitionById.get(req.params.id);
    return c ?? notFound(reply, `competition ${req.params.id} not found`);
  });

  // ─── Seasons ──────────────────────────────────────────────────────────────
  app.get<{ Querystring: { competition_id?: string } }>('/seasons', async (req) => {
    if (req.query.competition_id) {
      return store.seasonsByCompetition.get(req.query.competition_id) ?? [];
    }
    return store.seasons;
  });

  app.get<{ Params: { id: string } }>('/seasons/:id', async (req, reply) => {
    const s = store.seasonById.get(req.params.id);
    return s ?? notFound(reply, `season ${req.params.id} not found`);
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/fixtures', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    return store.fixturesBySeason.get(req.params.id) ?? [];
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/standings', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    return store.standingsBySeason.get(req.params.id) ?? [];
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/bracket', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    const b = store.bracketBySeason.get(req.params.id);
    return b ?? notFound(reply, `no bracket for season ${req.params.id}`);
  });

  // ─── Fixtures ─────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/fixtures/:id', async (req, reply) => {
    const f = store.fixtureById.get(req.params.id);
    return f ?? notFound(reply, `fixture ${req.params.id} not found`);
  });

  app.get<{ Params: { id: string } }>('/fixtures/:id/result', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    const r = store.resultByFixture.get(req.params.id);
    return r ?? notFound(reply, `no result for fixture ${req.params.id} yet`);
  });

  app.get<{ Params: { id: string } }>('/fixtures/:id/lineups', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    return store.lineupsByFixture.get(req.params.id) ?? [];
  });

  // ─── Teams ────────────────────────────────────────────────────────────────
  app.get('/teams', async () => store.teams);

  app.get<{ Params: { id: string } }>('/teams/:id', async (req, reply) => {
    const t = store.teamById.get(req.params.id);
    if (!t) return notFound(reply, `team ${req.params.id} not found`);
    const teamFixtures = store.fixturesByTeam.get(req.params.id) ?? [];
    return {
      ...t,
      fixtures: teamFixtures.slice().sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { season_id?: string } }>(
    '/teams/:id/squad',
    async (req, reply) => {
      if (!store.teamById.has(req.params.id)) {
        return notFound(reply, `team ${req.params.id} not found`);
      }
      const season_id = req.query.season_id;
      if (!season_id) {
        return reply
          .code(400)
          .send({ error: 'bad_request', message: 'season_id query param required' });
      }
      const key = `${req.params.id}::${season_id}`;
      const squad = store.squadByTeamSeason.get(key);
      if (!squad) {
        return notFound(reply, `no squad for team ${req.params.id} in season ${season_id}`);
      }
      const players = squad.player_ids
        .map((pid) => store.playerById.get(pid))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);
      return { squad, players };
    },
  );

  // ─── Players ──────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/players/:id', async (req, reply) => {
    const p = store.playerById.get(req.params.id);
    return p ?? notFound(reply, `player ${req.params.id} not found`);
  });

  // ─── Rankings ─────────────────────────────────────────────────────────────
  app.get('/rankings', async () => {
    const latest = store.rankings[store.rankings.length - 1];
    return latest ?? {};
  });

  app.get('/rankings/history', async () => store.rankings);
}
