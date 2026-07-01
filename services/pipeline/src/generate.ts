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
  LineUp,
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
  generateLineUp,
  generateRanking,
  generateResult,
  generateSquad,
  STARTING_POSITIONS,
} from './generators.js';
import { RUGBY_APP_SEED, TIER_1_TEAMS } from './registry.js';
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

for (const bundle of ALL_COMPETITIONS) {
  for (const fx of bundle.fixtures) {
    if (fx.status !== 'completed') continue;
    const r = generateResult(resultRng, fx);
    results.push(r);
    resultByFixture.set(fx.id, r);

    for (const teamId of [fx.home_team_id, fx.away_team_id] as const) {
      const squad = squadAcc.squadByKey.get(`${teamId}::${bundle.season.id}`);
      const posMap = playersByTeamAndPos.get(teamId);
      if (!squad || !posMap) continue;
      lineups.push(generateLineUp(lineupRng, fx, teamId, squad, posMap));
    }
  }
}

// ─── Standings for round-robin competitions ──────────────────────────────────

const standings: Standings[] = [];

for (const bundle of ALL_COMPETITIONS) {
  if (bundle.competition.format !== 'round-robin') continue;
  const completed = bundle.fixtures.filter((f) => f.status === 'completed');
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
}

// ─── Rankings (3 snapshots over the current calendar year) ───────────────────

const rankings: RankingSnapshot[] = [];
const snapshotDates = ['2026-01-15', '2026-04-01', TODAY_ISO];
let prevRankByTeam: Map<TeamId, number> | null = null;
for (const date of snapshotDates) {
  const snap = generateRanking(rankingRng, date, TIER_1_TEAMS, prevRankByTeam);
  rankings.push(snap);
  prevRankByTeam = new Map(snap.rows.map((r) => [r.team_id, r.rank]));
}

// ─── Brackets (none until World Cup fixtures are scoped) ─────────────────────

const brackets: Bracket[] = [];

// ─── Write JSON ──────────────────────────────────────────────────────────────

interface OutputFile { file: string; data: unknown }
const outputs: OutputFile[] = [
  { file: 'competitions.json', data: ALL_COMPETITIONS.map((b) => b.competition) },
  { file: 'seasons.json', data: ALL_COMPETITIONS.map((b) => b.season) },
  { file: 'teams.json', data: TIER_1_TEAMS },
  { file: 'players.json', data: squadAcc.players },
  { file: 'squads.json', data: squadAcc.squads },
  { file: 'fixtures.json', data: ALL_COMPETITIONS.flatMap((b) => b.fixtures) },
  { file: 'results.json', data: results },
  { file: 'lineups.json', data: lineups },
  { file: 'standings.json', data: standings },
  { file: 'brackets.json', data: brackets },
  { file: 'rankings.json', data: rankings },
];

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const { file, data } of outputs) {
  writeFileSync(join(OUTPUT_DIR, file), JSON.stringify(data, null, 2) + '\n');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const totals = {
  competitions: ALL_COMPETITIONS.length,
  seasons: ALL_COMPETITIONS.length,
  teams: TIER_1_TEAMS.length,
  players: squadAcc.players.length,
  squads: squadAcc.squads.length,
  fixtures: ALL_COMPETITIONS.reduce((n, b) => n + b.fixtures.length, 0),
  results: results.length,
  lineups: lineups.length,
  standings: standings.length,
  brackets: brackets.length,
  rankings: rankings.length,
};
// eslint-disable-next-line no-console -- CLI tool output
console.log('Wrote synthetic dataset:', totals);
console.log(`Output: ${OUTPUT_DIR}`);
