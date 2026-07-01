/**
 * Pure functions that turn RNG + minimal inputs into canonical entities.
 * All identifiers are owner-defined stable strings (pipeline CLAUDE.md
 * principle #3).
 */

import type {
  Fixture,
  LineUp,
  LineUpEntry,
  Player,
  Position,
  RankingRow,
  RankingSnapshot,
  Result,
  Squad,
  Standings,
  StandingsRow,
  Team,
  TeamId,
} from '@rugby-app/shared/types';

import type { Rng } from './rng.js';
import { FIRST_NAMES, LAST_NAMES } from './registry.js';

/** 15 starting positions in Rugby Union order. Shirt numbers 1-15 map here. */
export const STARTING_POSITIONS: readonly Position[] = [
  'loose-head-prop',
  'hooker',
  'tight-head-prop',
  'lock',
  'lock',
  'blindside-flanker',
  'openside-flanker',
  'number-8',
  'scrum-half',
  'fly-half',
  'left-wing',
  'inside-centre',
  'outside-centre',
  'right-wing',
  'fullback',
];

/** Bench (16-23) is 5 forwards + 3 backs in a typical modern 8-man bench.
 * We pick plausible cover positions. */
const BENCH_POSITIONS: readonly Position[] = [
  'hooker',
  'loose-head-prop',
  'tight-head-prop',
  'lock',
  'blindside-flanker',
  'scrum-half',
  'fly-half',
  'inside-centre',
];

/** Age windows keep synthetic DoBs plausible for pro rugby (19-38). */
function generateDob(rng: Rng, todayIso: string): string {
  const [ty, tm, td] = todayIso.split('-').map(Number) as [number, number, number];
  const ageYears = rng.int(19, 38);
  const y = ty - ageYears;
  const m = rng.int(1, 13);
  const d = rng.int(1, 28); // avoid month-length edge cases
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function heightForPosition(rng: Rng, pos: Position): number {
  // rough plausible ranges (cm)
  const ranges: Partial<Record<Position, [number, number]>> = {
    'loose-head-prop': [178, 190],
    hooker: [175, 188],
    'tight-head-prop': [180, 195],
    lock: [195, 210],
    'blindside-flanker': [188, 200],
    'openside-flanker': [180, 195],
    'number-8': [188, 200],
    'scrum-half': [170, 185],
    'fly-half': [175, 190],
    'inside-centre': [180, 193],
    'outside-centre': [180, 193],
    'left-wing': [180, 193],
    'right-wing': [180, 193],
    fullback: [180, 195],
  };
  const [lo, hi] = ranges[pos] ?? [178, 195];
  return rng.int(lo, hi + 1);
}

function weightForPosition(rng: Rng, pos: Position): number {
  const ranges: Partial<Record<Position, [number, number]>> = {
    'loose-head-prop': [110, 130],
    hooker: [105, 120],
    'tight-head-prop': [115, 135],
    lock: [115, 130],
    'blindside-flanker': [105, 120],
    'openside-flanker': [98, 115],
    'number-8': [108, 125],
    'scrum-half': [80, 92],
    'fly-half': [82, 95],
    'inside-centre': [90, 105],
    'outside-centre': [88, 102],
    'left-wing': [88, 100],
    'right-wing': [88, 100],
    fullback: [90, 105],
  };
  const [lo, hi] = ranges[pos] ?? [90, 110];
  return rng.int(lo, hi + 1);
}

export function generatePlayer(
  rng: Rng,
  teamId: TeamId,
  playerIndex: number,
  position: Position,
  todayIso: string,
): Player {
  return {
    id: `${teamId}-p${String(playerIndex).padStart(3, '0')}`,
    team_id: teamId,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    primary_position: position,
    date_of_birth: generateDob(rng, todayIso),
    height_cm: heightForPosition(rng, position),
    weight_kg: weightForPosition(rng, position),
    cap_count: rng.int(0, 90),
  };
}

/**
 * A 33-player squad: two per starting position (30), plus 3 utility forwards
 * of coach's choice — approximated as extras at flanker / lock.
 */
export function generateSquad(
  rng: Rng,
  teamId: TeamId,
  seasonId: string,
  todayIso: string,
): { squad: Squad; players: Player[] } {
  const players: Player[] = [];
  let idx = 1;
  for (const position of STARTING_POSITIONS) {
    players.push(generatePlayer(rng, teamId, idx++, position, todayIso));
    players.push(generatePlayer(rng, teamId, idx++, position, todayIso));
  }
  // 3 extra utility forwards
  for (const position of ['blindside-flanker', 'openside-flanker', 'lock'] as const) {
    players.push(generatePlayer(rng, teamId, idx++, position, todayIso));
  }

  const squad: Squad = {
    id: `${teamId}-${seasonId}-squad`,
    team_id: teamId,
    season_id: seasonId,
    player_ids: players.map((p) => p.id),
  };
  return { squad, players };
}

/**
 * Plausible-ish score generator. Not modelling team strength — just realistic
 * international scorelines with occasional blowouts.
 */
export function generateResult(rng: Rng, fixture: Fixture): Result {
  const homeAdvantage = rng.chance(0.6);
  const homeBase = rng.int(10, 30);
  const awayBase = rng.int(10, 30);
  const home_score = homeBase + (homeAdvantage ? rng.int(0, 8) : 0);
  const away_score = awayBase + (homeAdvantage ? 0 : rng.int(0, 8));

  const home_tries = Math.floor(home_score / 8) + rng.int(0, 2);
  const away_tries = Math.floor(away_score / 8) + rng.int(0, 2);
  const home_conversions = Math.min(home_tries, rng.int(0, home_tries + 1));
  const away_conversions = Math.min(away_tries, rng.int(0, away_tries + 1));
  const home_penalties = rng.int(0, 5);
  const away_penalties = rng.int(0, 5);
  const home_drop_goals = rng.chance(0.15) ? 1 : 0;
  const away_drop_goals = rng.chance(0.15) ? 1 : 0;

  return {
    fixture_id: fixture.id,
    home_score,
    away_score,
    half_time_home: Math.floor(home_score * rng.int(35, 55) / 100),
    half_time_away: Math.floor(away_score * rng.int(35, 55) / 100),
    home_tries,
    away_tries,
    home_conversions,
    away_conversions,
    home_penalties,
    away_penalties,
    home_drop_goals,
    away_drop_goals,
  };
}

export function generateLineUp(
  rng: Rng,
  fixture: Fixture,
  teamId: TeamId,
  squad: Squad,
  playerByPos: Map<Position, string[]>,
): LineUp {
  const used = new Set<string>();
  const pick = (pos: Position): string => {
    const pool = playerByPos.get(pos) ?? [];
    for (const id of rng.shuffle([...pool])) {
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
    // fallback to any unused squad member
    for (const id of squad.player_ids) if (!used.has(id)) { used.add(id); return id; }
    throw new Error(`ran out of players for ${teamId} in fixture ${fixture.id}`);
  };

  const starting: LineUpEntry[] = STARTING_POSITIONS.map((position, i) => ({
    shirt_number: i + 1,
    player_id: pick(position),
    position,
  }));
  const bench: LineUpEntry[] = BENCH_POSITIONS.map((position, i) => ({
    shirt_number: 16 + i,
    player_id: pick(position),
    position,
  }));

  return { fixture_id: fixture.id, team_id: teamId, starting_xv: starting, bench };
}

/** Table points per Result according to standard rugby scoring:
 * win = 4, draw = 2, loss = 0, plus try bonus (>=4 tries) and losing bonus
 * (loss by <=7). */
export function computeStandings(
  competitionId: string,
  seasonId: string,
  standingsId: string,
  teamIds: readonly TeamId[],
  completedFixtures: Fixture[],
  resultByFixture: Map<string, Result>,
): Standings {
  const acc = new Map<TeamId, StandingsRow>();
  for (const id of teamIds) {
    acc.set(id, {
      team_id: id, played: 0, won: 0, drawn: 0, lost: 0,
      points_for: 0, points_against: 0, points_difference: 0,
      try_bonus_points: 0, losing_bonus_points: 0,
      table_points: 0, rank: 0,
    });
  }

  for (const fx of completedFixtures) {
    const r = resultByFixture.get(fx.id);
    if (!r) continue;
    const home = acc.get(fx.home_team_id);
    const away = acc.get(fx.away_team_id);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.points_for += r.home_score; home.points_against += r.away_score;
    away.points_for += r.away_score; away.points_against += r.home_score;

    if (r.home_score > r.away_score) {
      home.won++; away.lost++;
      home.table_points += 4;
      if (r.home_score - r.away_score <= 7) { away.losing_bonus_points++; away.table_points++; }
    } else if (r.home_score < r.away_score) {
      away.won++; home.lost++;
      away.table_points += 4;
      if (r.away_score - r.home_score <= 7) { home.losing_bonus_points++; home.table_points++; }
    } else {
      home.drawn++; away.drawn++;
      home.table_points += 2; away.table_points += 2;
    }

    if (r.home_tries >= 4) { home.try_bonus_points++; home.table_points++; }
    if (r.away_tries >= 4) { away.try_bonus_points++; away.table_points++; }
  }

  for (const row of acc.values()) row.points_difference = row.points_for - row.points_against;

  const rows = [...acc.values()].sort(
    (a, b) => b.table_points - a.table_points || b.points_difference - a.points_difference,
  );
  rows.forEach((r, i) => { r.rank = i + 1; });

  return {
    id: standingsId,
    competition_id: competitionId,
    season_id: seasonId,
    group: null,
    rows,
  };
}

/**
 * Generate a World Rugby ranking snapshot for a date. Team ordering is a
 * shuffle influenced by a base "strength" — deterministic per RNG.
 */
export function generateRanking(
  rng: Rng,
  snapshotDate: string,
  teams: readonly Team[],
  previousRankByTeam: Map<TeamId, number> | null,
): RankingSnapshot {
  const shuffled = rng.shuffle([...teams]);
  const rows: RankingRow[] = shuffled.map((t, i) => {
    const rank = i + 1;
    const points = Math.round(90 - i * 1.9 + (rng.next() - 0.5) * 2);
    const previous_rank = previousRankByTeam?.get(t.id) ?? null;
    const movement = previous_rank == null ? null : previous_rank - rank;
    return { rank, team_id: t.id, points, previous_rank, movement };
  });

  return {
    id: `world-rugby-mens-${snapshotDate}`,
    source: 'world-rugby-mens',
    snapshot_date: snapshotDate,
    rows,
  };
}
