/**
 * Orchestrates the full synthetic dataset generation.
 *
 * Deterministic: given a fixed seed (registry.ts RUGBY_APP_SEED), the output
 * is byte-identical between runs. Regenerate freely; diff against committed
 * JSON to see what shape changes did.
 *
 * Guardrails enforced by callers, not here:
 *  - This output is dev-only. Never bundle into a production build (root
 *    CLAUDE.md §9).
 *  - UI consumers must render a persistent dev-mode indicator when serving
 *    from this dataset (PRD §5.5).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type {
  Bracket,
  Coach,
  LineUp,
  MatchEvent,
  Player,
  Position,
  RankingSnapshot,
  Result,
  Squad,
  Standings,
  TeamId,
} from '@rugby-app/shared/types';

import { ALL_COMPETITIONS, TODAY_ISO } from './competitions.js';
import {
  computeStandings,
  generateCoachingStaff,
  generateLineUp,
  generateMatchEvents,
  generateRanking,
  generateResult,
  generateSquad,
  STARTING_POSITIONS,
} from './generators.js';
import { ALL_TEAMS, RUGBY_APP_SEED } from './registry.js';
import { makeRng } from './rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'data');

// ─── RNG scoping ─────────────────────────────────────────────────────────────
// The root RNG forks per concern so unrelated changes stay stable across
// regenerations (e.g. tweaking result generation doesn't shift player names).

const root = makeRng(RUGBY_APP_SEED);
const squadRng = root.fork();
const resultRng = root.fork();
const lineupRng = root.fork();
const rankingRng = root.fork();
const womensRankingRng = root.fork();
const eventsRng = root.fork();
const coachRng = root.fork();

// ─── Squads and players ─────────────────────────────────────────────────────
// One squad per team per season that team participates in.

interface SquadAcc {
  players: Player[];
  squads: Squad[];
  playersByTeam: Map<TeamId, Player[]>;
  squadByKey: Map<string, Squad>; // key = `${teamId}::${seasonId}`
}

const squadAcc: SquadAcc = {
  players: [],
  squads: [],
  playersByTeam: new Map(),
  squadByKey: new Map(),
};

for (const bundle of ALL_COMPETITIONS) {
  for (const teamId of bundle.team_ids) {
    const key = `${teamId}::${bundle.season.id}`;
    if (squadAcc.squadByKey.has(key)) continue;
    const { squad, players } = generateSquad(squadRng, teamId, bundle.season.id, TODAY_ISO);
    squadAcc.squads.push(squad);
    squadAcc.players.push(...players);
    squadAcc.playersByTeam.set(teamId, [
      ...(squadAcc.playersByTeam.get(teamId) ?? []),
      ...players,
    ]);
    squadAcc.squadByKey.set(key, squad);
  }
}

// Index players by (team, position) for fast lineup picking.
const playersByTeamAndPos = new Map<TeamId, Map<Position, string[]>>();
for (const [teamId, players] of squadAcc.playersByTeam) {
  const map = new Map<Position, string[]>();
  for (const p of players) {
    const arr = map.get(p.primary_position) ?? [];
    arr.push(p.id);
    map.set(p.primary_position, arr);
  }
  // Ensure every position has at least one candidate — fill from any player.
  for (const pos of STARTING_POSITIONS) {
    if ((map.get(pos)?.length ?? 0) === 0) {
      map.set(pos, players.map((p) => p.id));
    }
  }
  playersByTeamAndPos.set(teamId, map);
}

// ─── Results + lineups for completed fixtures ────────────────────────────────

const results: Result[] = [];
const resultByFixture = new Map<string, Result>();
const lineups: LineUp[] = [];
const events: MatchEvent[] = [];

for (const bundle of ALL_COMPETITIONS) {
  for (const fx of bundle.fixtures) {
    if (fx.status !== 'completed') continue;
    const r = generateResult(resultRng, fx);
    results.push(r);
    resultByFixture.set(fx.id, r);

    // Lineups first — the event generator uses them for player attribution.
    let homeLineup: LineUp | undefined;
    let awayLineup: LineUp | undefined;
    for (const teamId of [fx.home_team_id, fx.away_team_id] as const) {
      const squad = squadAcc.squadByKey.get(`${teamId}::${bundle.season.id}`);
      const posMap = playersByTeamAndPos.get(teamId);
      if (!squad || !posMap) continue;
      const lu = generateLineUp(lineupRng, fx, teamId, squad, posMap);
      lineups.push(lu);
      if (teamId === fx.home_team_id) homeLineup = lu;
      else awayLineup = lu;
    }

    // Event timeline — reconciled to Result (try/conv/pen/drop counts match),
    // players sourced from the lineups just produced.
    for (const ev of generateMatchEvents(eventsRng, fx, r, homeLineup, awayLineup)) {
      events.push(ev);
    }
  }
}

// ─── Standings ───────────────────────────────────────────────────────────────
// Round-robin competitions get one table. Pool-and-knockout competitions get
// one table per pool (group), even when the pool stage is upcoming — this
// gives the UI a rendered "pool stage" surface with zero rows before kickoff.

const standings: Standings[] = [];

for (const bundle of ALL_COMPETITIONS) {
  const completed = bundle.fixtures.filter((f) => f.status === 'completed');

  if (bundle.competition.format === 'round-robin') {
    standings.push(
      computeStandings(
        bundle.competition.id,
        bundle.season.id,
        `${bundle.season.id}-standings`,
        bundle.team_ids,
        completed,
        resultByFixture,
      ),
    );
    continue;
  }

  if (bundle.competition.format === 'pool-and-knockout' && bundle.pools) {
    for (const [poolName, poolTeamIds] of Object.entries(bundle.pools)) {
      const poolFixtures = completed.filter(
        (f) => f.round?.startsWith(poolName) ?? false,
      );
      const table = computeStandings(
        bundle.competition.id,
        bundle.season.id,
        `${bundle.season.id}-${poolName.replace(' ', '').toLowerCase()}-standings`,
        poolTeamIds,
        poolFixtures,
        resultByFixture,
      );
      table.group = poolName;
      standings.push(table);
    }
  }
}

// ─── Rankings ─────────────────────────────────────────────────────────────────
// 13 monthly snapshots (12-month rolling window ending at TODAY_ISO) for both
// men's and women's rankings — feeds the Insights → Ranking Trajectory chart.
// Real World Rugby releases weekly during test windows; a monthly cadence is a
// reasonable simplification for the synthetic dev dataset. Register #3 flipped
// 2026-07-02 to bring women's rankings into v1 scope.

const rankings: RankingSnapshot[] = [];
const snapshotDates = [
  '2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01',
  '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01',
  '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
  TODAY_ISO,
];

let prevMensRankByTeam: Map<TeamId, number> | null = null;
for (const date of snapshotDates) {
  const snap = generateRanking(rankingRng, date, ALL_TEAMS, prevMensRankByTeam, 'world-rugby-mens');
  rankings.push(snap);
  prevMensRankByTeam = new Map(snap.rows.map((r) => [r.team_id, r.rank]));
}

let prevWomensRankByTeam: Map<TeamId, number> | null = null;
for (const date of snapshotDates) {
  const snap = generateRanking(womensRankingRng, date, ALL_TEAMS, prevWomensRankByTeam, 'world-rugby-womens');
  rankings.push(snap);
  prevWomensRankByTeam = new Map(snap.rows.map((r) => [r.team_id, r.rank]));
}

// ─── Brackets ────────────────────────────────────────────────────────────────
// Emit whichever bundles carry a bracket. Knockout fixture_ids are empty for
// upcoming tournaments — they populate when pool results resolve matchups.

const brackets: Bracket[] = ALL_COMPETITIONS
  .map((b) => b.bracket)
  .filter((b): b is Bracket => b !== undefined);

// ─── Coaching staff ──────────────────────────────────────────────────────────
// One synthetic staff (head + attack + defence + forwards coach) per team.
// Availability from real feeds is PRD register #7 — if aggregator feeds
// don't carry coaching data, this generation is dropped and the endpoint
// returns an empty array (UI section hides itself).

const coaches: Coach[] = ALL_TEAMS.flatMap((team) => generateCoachingStaff(coachRng, team.id));

// ─── Write JSON ──────────────────────────────────────────────────────────────

interface OutputFile { file: string; data: unknown }
const outputs: OutputFile[] = [
  { file: 'competitions.json', data: ALL_COMPETITIONS.map((b) => b.competition) },
  { file: 'seasons.json', data: ALL_COMPETITIONS.map((b) => b.season) },
  { file: 'teams.json', data: ALL_TEAMS },
  { file: 'players.json', data: squadAcc.players },
  { file: 'squads.json', data: squadAcc.squads },
  { file: 'fixtures.json', data: ALL_COMPETITIONS.flatMap((b) => b.fixtures) },
  { file: 'results.json', data: results },
  { file: 'lineups.json', data: lineups },
  { file: 'standings.json', data: standings },
  { file: 'brackets.json', data: brackets },
  { file: 'rankings.json', data: rankings },
  { file: 'events.json', data: events },
  { file: 'coaches.json', data: coaches },
];

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const { file, data } of outputs) {
  writeFileSync(join(OUTPUT_DIR, file), JSON.stringify(data, null, 2) + '\n');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const totals = {
  competitions: ALL_COMPETITIONS.length,
  seasons: ALL_COMPETITIONS.length,
  teams: ALL_TEAMS.length,
  players: squadAcc.players.length,
  squads: squadAcc.squads.length,
  fixtures: ALL_COMPETITIONS.reduce((n, b) => n + b.fixtures.length, 0),
  results: results.length,
  lineups: lineups.length,
  standings: standings.length,
  brackets: brackets.length,
  rankings: rankings.length,
  events: events.length,
  coaches: coaches.length,
};
// eslint-disable-next-line no-console -- CLI tool output
console.log('Wrote synthetic dataset:', totals);
console.log(`Output: ${OUTPUT_DIR}`);
