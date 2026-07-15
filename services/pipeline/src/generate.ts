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
  MatchOfficial,
  Player,
  PlayerMatchStats,
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
  generateMatchOfficials,
  generatePlayerMatchStats,
  generateAnchoredRankingSeries,
  generateRanking,
  generateResult,
  generateTeamPool,
  selectSquadFromPool,
} from './generators.js';
import { ALL_TEAMS, RUGBY_APP_SEED } from './registry.js';
import { makeRng } from './rng.js';
import { MENS_RANKING_SEED } from './world-ranking-seed.js';

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
// Women's slot retired (men's-only, register #3, 2026-07-15) — the fork
// stays so every downstream rng keeps its deterministic sequence.
root.fork();
const eventsRng = root.fork();
const coachRng = root.fork();
const officialRng = root.fork();
const playerStatsRng = root.fork();

// ─── Player pools and season squads ──────────────────────────────────────────
// ONE persistent 45-player pool per team (stable IDs, same humans across
// every season), then one squad per (team, season) SELECTED from that
// pool. Players accumulate appearances across competitions the way real
// internationals do, and IDs never collide across season bundles.

const teamPools = new Map<TeamId, Player[]>();
const squads: Squad[] = [];
const squadByKey = new Map<string, Squad>(); // key = `${teamId}::${seasonId}`

for (const bundle of ALL_COMPETITIONS) {
  for (const teamId of bundle.team_ids) {
    if (!teamPools.has(teamId)) {
      teamPools.set(teamId, generateTeamPool(squadRng, teamId, TODAY_ISO));
    }
    const key = `${teamId}::${bundle.season.id}`;
    if (squadByKey.has(key)) continue;
    const squad = selectSquadFromPool(
      squadRng,
      teamId,
      bundle.season.id,
      teamPools.get(teamId)!,
    );
    squads.push(squad);
    squadByKey.set(key, squad);
  }
}

const allPlayers: Player[] = [...teamPools.values()].flat();
const playerById = new Map(allPlayers.map((p) => [p.id, p]));

// Position index per SEASON SQUAD (not per team) so lineups only field
// players actually named in that season's squad. Every position is
// guaranteed two-deep by the selection template, so no fill fallback
// is needed.
const posMapBySquadKey = new Map<string, Map<Position, string[]>>();
for (const squad of squads) {
  const map = new Map<Position, string[]>();
  for (const pid of squad.player_ids) {
    const p = playerById.get(pid);
    if (!p) continue;
    const arr = map.get(p.primary_position) ?? [];
    arr.push(pid);
    map.set(p.primary_position, arr);
  }
  posMapBySquadKey.set(`${squad.team_id}::${squad.season_id}`, map);
}

// ─── Results + lineups for completed fixtures ────────────────────────────────

const results: Result[] = [];
const resultByFixture = new Map<string, Result>();
const lineups: LineUp[] = [];
const events: MatchEvent[] = [];
const playerMatchStats: PlayerMatchStats[] = [];

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
      const squad = squadByKey.get(`${teamId}::${bundle.season.id}`);
      const posMap = posMapBySquadKey.get(`${teamId}::${bundle.season.id}`);
      if (!squad || !posMap) continue;
      const lu = generateLineUp(lineupRng, fx, teamId, squad, posMap);
      lineups.push(lu);
      if (teamId === fx.home_team_id) homeLineup = lu;
      else awayLineup = lu;
    }

    // Event timeline — reconciled to Result (try/conv/pen/drop counts match),
    // players sourced from the lineups just produced.
    const fxEvents = generateMatchEvents(eventsRng, fx, r, homeLineup, awayLineup);
    events.push(...fxEvents);

    // Per-player stat sheets — one per matchday-23 member of a completed
    // fixture. Event-derived counts reconcile with the timeline above;
    // distributed counts sum per side exactly to the Result totals.
    const fxLineups = [homeLineup, awayLineup].filter((l): l is LineUp => l !== undefined);
    playerMatchStats.push(
      ...generatePlayerMatchStats(playerStatsRng, fx, r, fxLineups, fxEvents),
    );
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

// Men's series is anchored to the REAL World Rugby table (see
// world-ranking-seed.ts): the latest snapshot matches reality, history
// drifts backwards from it.
rankings.push(
  ...generateAnchoredRankingSeries(rankingRng, snapshotDates, MENS_RANKING_SEED, 'world-rugby-mens'),
);


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

// ─── Match officials ─────────────────────────────────────────────────────────
// Standard 4-slot slate per fixture. Announced pre-match in real life, so
// every fixture (scheduled or completed) gets a full assignment.

const officials: MatchOfficial[] = ALL_COMPETITIONS.flatMap((bundle) =>
  bundle.fixtures.flatMap((fx) => generateMatchOfficials(officialRng, fx)),
);

// ─── Write JSON ──────────────────────────────────────────────────────────────

interface OutputFile { file: string; data: unknown }
const outputs: OutputFile[] = [
  { file: 'competitions.json', data: ALL_COMPETITIONS.map((b) => b.competition) },
  { file: 'seasons.json', data: ALL_COMPETITIONS.map((b) => b.season) },
  { file: 'teams.json', data: ALL_TEAMS },
  { file: 'players.json', data: allPlayers },
  { file: 'squads.json', data: squads },
  { file: 'fixtures.json', data: ALL_COMPETITIONS.flatMap((b) => b.fixtures) },
  { file: 'results.json', data: results },
  { file: 'lineups.json', data: lineups },
  { file: 'standings.json', data: standings },
  { file: 'brackets.json', data: brackets },
  { file: 'rankings.json', data: rankings },
  { file: 'events.json', data: events },
  { file: 'coaches.json', data: coaches },
  { file: 'officials.json', data: officials },
  { file: 'player-match-stats.json', data: playerMatchStats },
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
  players: allPlayers.length,
  squads: squads.length,
  fixtures: ALL_COMPETITIONS.reduce((n, b) => n + b.fixtures.length, 0),
  results: results.length,
  lineups: lineups.length,
  standings: standings.length,
  brackets: brackets.length,
  rankings: rankings.length,
  events: events.length,
  coaches: coaches.length,
  officials: officials.length,
  playerMatchStats: playerMatchStats.length,
};
// eslint-disable-next-line no-console -- CLI tool output
console.log('Wrote synthetic dataset:', totals);
console.log(`Output: ${OUTPUT_DIR}`);
