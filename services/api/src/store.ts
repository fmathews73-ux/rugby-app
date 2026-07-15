/**
 * Loads the canonical dataset from JSON on startup and indexes it for O(1)
 * lookups. In-memory: the dataset is small (~10 MB) and read-only per
 * process. On real-feed cutover, this loader is swapped for a DB-backed
 * store implementing the same interface.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Bracket,
  Coach,
  Competition,
  CompetitionId,
  Fixture,
  FixtureId,
  LineUp,
  Player,
  PlayerId,
  PlayerMatchStats,
  MatchEvent,
  MatchOfficial,
  RankingSnapshot,
  Result,
  Season,
  SeasonId,
  Squad,
  Standings,
  Team,
  TeamId,
} from '@rugby-app/shared/types';

export interface Store {
  competitions: readonly Competition[];
  competitionById: ReadonlyMap<CompetitionId, Competition>;

  seasons: readonly Season[];
  seasonById: ReadonlyMap<SeasonId, Season>;
  seasonsByCompetition: ReadonlyMap<CompetitionId, Season[]>;

  teams: readonly Team[];
  teamById: ReadonlyMap<TeamId, Team>;

  players: readonly Player[];
  playerById: ReadonlyMap<PlayerId, Player>;
  playersByTeam: ReadonlyMap<TeamId, Player[]>;

  squads: readonly Squad[];
  /** Key: `${teamId}::${seasonId}`. */
  squadByTeamSeason: ReadonlyMap<string, Squad>;

  fixtures: readonly Fixture[];
  fixtureById: ReadonlyMap<FixtureId, Fixture>;
  fixturesBySeason: ReadonlyMap<SeasonId, Fixture[]>;
  fixturesByTeam: ReadonlyMap<TeamId, Fixture[]>;

  results: readonly Result[];
  resultByFixture: ReadonlyMap<FixtureId, Result>;

  lineups: readonly LineUp[];
  lineupsByFixture: ReadonlyMap<FixtureId, LineUp[]>;

  standings: readonly Standings[];
  standingsBySeason: ReadonlyMap<SeasonId, Standings[]>;

  brackets: readonly Bracket[];
  bracketBySeason: ReadonlyMap<SeasonId, Bracket>;

  rankings: readonly RankingSnapshot[];
  mensRankings: readonly RankingSnapshot[];

  events: readonly MatchEvent[];
  eventsByFixture: ReadonlyMap<FixtureId, MatchEvent[]>;

  coaches: readonly Coach[];
  coachesByTeam: ReadonlyMap<TeamId, Coach[]>;

  officials: readonly MatchOfficial[];
  officialsByFixture: ReadonlyMap<FixtureId, MatchOfficial[]>;

  playerMatchStats: readonly PlayerMatchStats[];
  playerStatsByFixture: ReadonlyMap<FixtureId, PlayerMatchStats[]>;
  playerStatsByPlayer: ReadonlyMap<PlayerId, PlayerMatchStats[]>;
}

function readJson<T>(dir: string, file: string): T {
  return JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = out.get(k) ?? [];
    arr.push(item);
    out.set(k, arr);
  }
  return out;
}

function indexBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T> {
  const out = new Map<K, T>();
  for (const item of items) out.set(key(item), item);
  return out;
}

export function loadStore(dataDir: string): Store {
  const competitions = readJson<Competition[]>(dataDir, 'competitions.json');
  const seasons = readJson<Season[]>(dataDir, 'seasons.json');
  const teams = readJson<Team[]>(dataDir, 'teams.json');
  const players = readJson<Player[]>(dataDir, 'players.json');
  const squads = readJson<Squad[]>(dataDir, 'squads.json');
  const fixtures = readJson<Fixture[]>(dataDir, 'fixtures.json');
  const results = readJson<Result[]>(dataDir, 'results.json');
  const lineups = readJson<LineUp[]>(dataDir, 'lineups.json');
  const standings = readJson<Standings[]>(dataDir, 'standings.json');
  const brackets = readJson<Bracket[]>(dataDir, 'brackets.json');
  const rankings = readJson<RankingSnapshot[]>(dataDir, 'rankings.json');
  const events = readJson<MatchEvent[]>(dataDir, 'events.json');
  const coaches = readJson<Coach[]>(dataDir, 'coaches.json');
  const officials = readJson<MatchOfficial[]>(dataDir, 'officials.json');
  const playerMatchStats = readJson<PlayerMatchStats[]>(dataDir, 'player-match-stats.json');

  const fixturesByTeam = new Map<TeamId, Fixture[]>();
  for (const fx of fixtures) {
    for (const tid of [fx.home_team_id, fx.away_team_id]) {
      const arr = fixturesByTeam.get(tid) ?? [];
      arr.push(fx);
      fixturesByTeam.set(tid, arr);
    }
  }

  return {
    competitions,
    competitionById: indexBy(competitions, (c) => c.id),

    seasons,
    seasonById: indexBy(seasons, (s) => s.id),
    seasonsByCompetition: groupBy(seasons, (s) => s.competition_id),

    teams,
    teamById: indexBy(teams, (t) => t.id),

    players,
    playerById: indexBy(players, (p) => p.id),
    playersByTeam: groupBy(players, (p) => p.team_id),

    squads,
    squadByTeamSeason: indexBy(squads, (s) => `${s.team_id}::${s.season_id}`),

    fixtures,
    fixtureById: indexBy(fixtures, (f) => f.id),
    fixturesBySeason: groupBy(fixtures, (f) => f.season_id),
    fixturesByTeam,

    results,
    resultByFixture: indexBy(results, (r) => r.fixture_id),

    lineups,
    lineupsByFixture: groupBy(lineups, (l) => l.fixture_id),

    standings,
    standingsBySeason: groupBy(standings, (s) => s.season_id),

    brackets,
    bracketBySeason: indexBy(brackets, (b) => b.season_id),

    rankings: rankings.slice().sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)),
    mensRankings: rankings
      .filter((r) => r.source === 'world-rugby-mens')
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)),

    events,
    eventsByFixture: groupBy(events, (e) => e.fixture_id),

    coaches,
    coachesByTeam: groupBy(coaches, (c) => c.team_id),

    officials,
    officialsByFixture: groupBy(officials, (o) => o.fixture_id),

    playerMatchStats,
    playerStatsByFixture: groupBy(playerMatchStats, (s) => s.fixture_id),
    playerStatsByPlayer: groupBy(playerMatchStats, (s) => s.player_id),
  };
}
