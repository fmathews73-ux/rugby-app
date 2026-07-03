/**
 * Pure functions that turn RNG + minimal inputs into canonical entities.
 * All identifiers are owner-defined stable strings (pipeline CLAUDE.md
 * principle #3).
 */

import type {
  Coach,
  CoachRole,
  Fixture,
  LineUp,
  LineUpEntry,
  MatchEvent,
  MatchEventType,
  MatchOfficial,
  MatchOfficialRole,
  Player,
  PlayerId,
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
  // Generate scoring components first, then derive the score from them, so
  // 5×tries + 2×conversions + 3×penalty-goals + 3×drop-goals ALWAYS equals
  // `home_score` / `away_score`. The event timeline (see `generateMatchEvents`)
  // relies on this reconciliation — one try event, one conversion event, etc.,
  // summing exactly to the recorded scoreboard.
  const homeAdvantage = rng.chance(0.6);
  const home_tries = rng.int(2, homeAdvantage ? 6 : 4);
  const away_tries = rng.int(2, homeAdvantage ? 4 : 6);
  const home_conversions = Math.min(home_tries, rng.int(0, home_tries));
  const away_conversions = Math.min(away_tries, rng.int(0, away_tries));
  const home_penalties = rng.int(0, 4);
  const away_penalties = rng.int(0, 4);
  const home_drop_goals = rng.chance(0.12) ? 1 : 0;
  const away_drop_goals = rng.chance(0.12) ? 1 : 0;
  const home_score =
    home_tries * 5 + home_conversions * 2 + home_penalties * 3 + home_drop_goals * 3;
  const away_score =
    away_tries * 5 + away_conversions * 2 + away_penalties * 3 + away_drop_goals * 3;

  // Possession / territory: home value 35-65, other side is 100 - that.
  const home_possession_percent = rng.int(35, 66);
  const away_possession_percent = 100 - home_possession_percent;
  const home_territory_percent = rng.int(35, 66);
  const away_territory_percent = 100 - home_territory_percent;

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

    home_possession_percent,
    away_possession_percent,
    home_territory_percent,
    away_territory_percent,

    home_meters: rng.int(300, 700),
    away_meters: rng.int(300, 700),
    home_line_breaks: rng.int(2, 15),
    away_line_breaks: rng.int(2, 15),
    home_carries: rng.int(100, 180),
    away_carries: rng.int(100, 180),
    home_passes: rng.int(100, 200),
    away_passes: rng.int(100, 200),
    home_offloads: rng.int(3, 16),
    away_offloads: rng.int(3, 16),

    home_kicks_in_play: rng.int(10, 30),
    away_kicks_in_play: rng.int(10, 30),
    home_kicks_to_touch: rng.int(5, 20),
    away_kicks_to_touch: rng.int(5, 20),
    home_kick_meters: rng.int(300, 700),
    away_kick_meters: rng.int(300, 700),

    home_scrums_won: rng.int(4, 11),
    away_scrums_won: rng.int(4, 11),
    home_scrums_lost: rng.int(0, 4),
    away_scrums_lost: rng.int(0, 4),
    home_lineouts_won: rng.int(8, 17),
    away_lineouts_won: rng.int(8, 17),
    home_lineouts_lost: rng.int(1, 5),
    away_lineouts_lost: rng.int(1, 5),

    home_tackles_made: rng.int(100, 200),
    away_tackles_made: rng.int(100, 200),
    home_tackle_success_percent: rng.int(80, 96),
    away_tackle_success_percent: rng.int(80, 96),
    home_turnovers_won: rng.int(3, 13),
    away_turnovers_won: rng.int(3, 13),
    home_turnovers_conceded: rng.int(3, 15),
    away_turnovers_conceded: rng.int(3, 15),

    home_penalties_conceded: rng.int(5, 16),
    away_penalties_conceded: rng.int(5, 16),
    home_handling_errors: rng.int(5, 16),
    away_handling_errors: rng.int(5, 16),
    home_yellow_cards: rng.chance(0.3) ? rng.int(1, 3) : 0,
    away_yellow_cards: rng.chance(0.3) ? rng.int(1, 3) : 0,
    home_red_cards: rng.chance(0.05) ? 1 : 0,
    away_red_cards: rng.chance(0.05) ? 1 : 0,
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
 * Generate a World Rugby ranking snapshot for a date. First snapshot in a
 * series is a fresh shuffle; subsequent snapshots perturb the previous
 * ranking by ±2 positions so the trajectory reads as gradual Elo-style
 * drift rather than random reshuffling. Points are anchored to the rank
 * (so #1 always has more points than #10) with small per-snapshot jitter.
 *
 * `source` selects mens / womens — different RNG forks feed different
 * shuffles, so the two ranking tables have plausibly different orderings
 * even though the team pool overlaps.
 */
export function generateRanking(
  rng: Rng,
  snapshotDate: string,
  teams: readonly Team[],
  previousRankByTeam: Map<TeamId, number> | null,
  source: RankingSnapshot['source'] = 'world-rugby-mens',
): RankingSnapshot {
  let ordered: Team[];
  if (previousRankByTeam) {
    // Perturb the previous ranking. Jitter magnitude tuned so most teams
    // shift 0–2 positions per snapshot, occasional 3–4.
    const withScore = teams.map((t) => {
      const prev = previousRankByTeam.get(t.id) ?? teams.length;
      const jitter = (rng.next() - 0.5) * 4; // ~[-2, +2]
      return { team: t, score: prev + jitter };
    });
    withScore.sort((a, b) => a.score - b.score);
    ordered = withScore.map((w) => w.team);
  } else {
    ordered = rng.shuffle([...teams]);
  }
  const rows: RankingRow[] = ordered.map((t, i) => {
    const rank = i + 1;
    const points = Math.round(90 - i * 1.9 + (rng.next() - 0.5) * 2);
    const previous_rank = previousRankByTeam?.get(t.id) ?? null;
    const movement = previous_rank == null ? null : previous_rank - rank;
    return { rank, team_id: t.id, points, previous_rank, movement };
  });

  return {
    id: `${source}-${snapshotDate}`,
    source,
    snapshot_date: snapshotDate,
    rows,
  };
}

/**
 * Generate a chronological match-event timeline for a completed fixture.
 *
 * Reconciled to the fixture's `Result`: the count of try / conversion /
 * penalty-goal / drop-goal events equals the counts already in the result,
 * so the timeline sums to the recorded final score. Cards and substitutions
 * are independent of the score — plausible per-team totals.
 *
 * Player attribution comes from the fixture's lineups. Tries are attributed
 * to a random player on the field. Kicks (conversions / penalty goals /
 * drop goals) are attributed to the team's kicker — approximated as the
 * fly-half (starting XV #10) with fallback to any starter if position 10
 * isn't in the lineup for this synthetic run.
 *
 * Milestones (kick-off, half-time, second-half-start, full-time) are always
 * emitted for a completed fixture. Team-agnostic; no player attribution.
 *
 * Returns events sorted ascending by (minute, stoppage) — kick-off first,
 * full-time last. Consumers can reverse for a "recent-first" render.
 */
export function generateMatchEvents(
  rng: Rng,
  fixture: Fixture,
  result: Result,
  homeLineup: LineUp | undefined,
  awayLineup: LineUp | undefined,
): MatchEvent[] {
  const events: MatchEvent[] = [];

  // 1. Milestones — every completed match gets these four.
  const milestone = (
    type: MatchEventType,
    minute: number,
    stoppage = 0,
  ): MatchEvent => ({
    id: `${fixture.id}-${type}`,
    fixture_id: fixture.id,
    minute,
    stoppage,
    team_id: null,
    player_id: null,
    related_player_id: null,
    type,
    points: 0,
    x: null,
    y: null,
  });
  events.push(milestone('kick-off', 0));
  events.push(milestone('half-time', 40));
  events.push(milestone('second-half-start', 40));
  events.push(milestone('full-time', 80));

  // 2. Scoring events — emit try/conversion/penalty-goal/drop-goal counts
  //    per team as recorded in the Result, so the timeline sums exactly to
  //    the scoreboard.
  const homeStarters = homeLineup?.starting_xv ?? [];
  const awayStarters = awayLineup?.starting_xv ?? [];
  const homeKicker = pickKicker(homeStarters);
  const awayKicker = pickKicker(awayStarters);

  addScoringForSide(rng, events, fixture, {
    team_id: fixture.home_team_id,
    tries: result.home_tries,
    conversions: result.home_conversions,
    penaltyGoals: result.home_penalties,
    dropGoals: result.home_drop_goals,
    starters: homeStarters,
    kicker: homeKicker,
    isHome: true,
  });
  addScoringForSide(rng, events, fixture, {
    team_id: fixture.away_team_id,
    tries: result.away_tries,
    conversions: result.away_conversions,
    penaltyGoals: result.away_penalties,
    dropGoals: result.away_drop_goals,
    starters: awayStarters,
    kicker: awayKicker,
    isHome: false,
  });

  // 3. Cards — driven by the counts in `Result`. Yellow-card minutes
  //    scattered across both halves; red cards rare, second-half heavy.
  addCardsForSide(rng, events, fixture, {
    team_id: fixture.home_team_id,
    yellows: result.home_yellow_cards,
    reds: result.home_red_cards,
    starters: homeStarters,
    isHome: true,
  });
  addCardsForSide(rng, events, fixture, {
    team_id: fixture.away_team_id,
    yellows: result.away_yellow_cards,
    reds: result.away_red_cards,
    starters: awayStarters,
    isHome: false,
  });

  // 4. Substitutions — rugby bench is 16-23 (8 subs). Typical usage is
  //    3-7 subs per team, mostly in the 45'-75' window. Skip if lineups
  //    aren't available for this fixture.
  if (homeLineup) {
    addSubstitutions(rng, events, fixture, {
      team_id: fixture.home_team_id,
      lineup: homeLineup,
      isHome: true,
    });
  }
  if (awayLineup) {
    addSubstitutions(rng, events, fixture, {
      team_id: fixture.away_team_id,
      lineup: awayLineup,
      isHome: false,
    });
  }

  // 5. Positional play samples ("carries") — 30 per team per match,
  //    biased by each team's territorial share so the density on the
  //    pitch heatmap reflects the match narrative.
  addCarriesForSide(rng, events, fixture, {
    team_id: fixture.home_team_id,
    isHome: true,
    territoryPercent: result.home_territory_percent,
    starters: homeStarters,
  });
  addCarriesForSide(rng, events, fixture, {
    team_id: fixture.away_team_id,
    isHome: false,
    territoryPercent: result.away_territory_percent,
    starters: awayStarters,
  });

  // 6. Per-player stat events — tackles / turnovers / line breaks / try
  //    assists. Counts anchored on Result totals; distribution across the
  //    starting XV weighted by forward-vs-back role. Previews what the
  //    Player Leaders card will look like once Opta's per-player stat
  //    sheets stream in at Phase 6 cutover.
  addStatEventsForSide(rng, events, fixture, {
    team_id: fixture.home_team_id,
    isHome: true,
    starters: homeStarters,
    tackles: result.home_tackles_made,
    lineBreaks: result.home_line_breaks,
    turnoversWon: result.home_turnovers_won,
    tries: result.home_tries,
  });
  addStatEventsForSide(rng, events, fixture, {
    team_id: fixture.away_team_id,
    isHome: false,
    starters: awayStarters,
    tackles: result.away_tackles_made,
    lineBreaks: result.away_line_breaks,
    turnoversWon: result.away_turnovers_won,
    tries: result.away_tries,
  });

  // Sort ascending by (minute, stoppage). Ties resolve stably by the order
  // events were appended above — kick-off before first try, etc.
  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.stoppage - b.stoppage;
  });

  return events;
}

// ─── Match-event helpers ─────────────────────────────────────────────────────

/** Kicker for a team — the fly-half (position 10). Fallback: any starter
 * whose position isn't listed if the fly-half slot isn't in this lineup. */
function pickKicker(starters: readonly LineUpEntry[]): PlayerId | null {
  const fly = starters.find((e) => e.position === 'fly-half');
  if (fly) return fly.player_id;
  return starters[0]?.player_id ?? null;
}

/** Random player from a starting XV. Never returns null if `starters`
 * has at least one entry. */
function pickRandomStarter(rng: Rng, starters: readonly LineUpEntry[]): PlayerId | null {
  if (starters.length === 0) return null;
  return starters[rng.int(0, starters.length - 1)]?.player_id ?? null;
}

/**
 * Return `count` minutes spread across a range, ordered ascending, no
 * duplicates. Used to space out scoring events across the match so the
 * timeline reads naturally.
 */
function spreadMinutes(rng: Rng, count: number, from: number, to: number): number[] {
  if (count <= 0) return [];
  const minutes = new Set<number>();
  while (minutes.size < count) {
    minutes.add(rng.int(from, to));
  }
  return [...minutes].sort((a, b) => a - b);
}

interface SideScoring {
  team_id: TeamId;
  tries: number;
  conversions: number;
  penaltyGoals: number;
  dropGoals: number;
  starters: readonly LineUpEntry[];
  kicker: PlayerId | null;
  isHome: boolean;
}

function addScoringForSide(
  rng: Rng,
  out: MatchEvent[],
  fixture: Fixture,
  side: SideScoring,
): void {
  const idSuffix = side.isHome ? 'h' : 'a';
  // Pitch convention: x=0 is the left try line (which the HOME team
  // defends), x=1 is the right try line (which the HOME team attacks).
  // Score-position samplers below flip based on which side is scoring.
  const tryLineX = side.isHome ? 1 : 0;
  const inGoalX = () => {
    // Try landings cluster within 5m of the try line — normalised to
    // 0.05 of pitch length.
    const offset = rng.next() * 0.05;
    return side.isHome ? 1 - offset : offset;
  };
  const penaltyKickX = () => {
    // Penalty goals are attempted from the attacking half, typically
    // 30–70m out from the posts (0.30–0.70 of pitch length from the
    // attacking try line).
    const distFromTryLine = 0.3 + rng.next() * 0.4;
    return side.isHome ? 1 - distFromTryLine : distFromTryLine;
  };
  const dropGoalX = () => {
    // Drops are usually 20–40m out from the posts.
    const distFromTryLine = 0.2 + rng.next() * 0.2;
    return side.isHome ? 1 - distFromTryLine : distFromTryLine;
  };
  const laneY = () => 0.15 + rng.next() * 0.7;   // Broad lateral spread.
  const centreY = () => 0.4 + rng.next() * 0.2;  // Tighter for kicks at goal.

  // Tries: spread across 1..79. Each try may be followed by a conversion
  // attempt at the same minute; we allocate conversions up to the try
  // count sequentially so conversions never exceed tries.
  const tryMinutes = spreadMinutes(rng, side.tries, 1, 78);
  const convertsRemaining = Math.min(side.conversions, side.tries);
  for (let i = 0; i < tryMinutes.length; i++) {
    const minute = tryMinutes[i]!;
    const tryY = laneY();
    out.push({
      id: `${fixture.id}-try-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute,
      stoppage: 0,
      team_id: side.team_id,
      player_id: pickRandomStarter(rng, side.starters),
      related_player_id: null,
      type: 'try',
      points: 5,
      x: inGoalX(),
      y: tryY,
    });
    if (i < convertsRemaining) {
      out.push({
        id: `${fixture.id}-conv-${idSuffix}-${i}`,
        fixture_id: fixture.id,
        minute,
        stoppage: 1,
        team_id: side.team_id,
        player_id: side.kicker,
        related_player_id: null,
        type: 'conversion',
        points: 2,
        // Conversion is taken from ~10m out at an angle depending on
        // where the try was scored — mirror the try's y for realism.
        x: side.isHome ? 0.9 : 0.1,
        y: tryY,
      });
    }
  }
  // Penalty goals: spread across 5..75.
  const penMinutes = spreadMinutes(rng, side.penaltyGoals, 5, 75);
  for (let i = 0; i < penMinutes.length; i++) {
    out.push({
      id: `${fixture.id}-pen-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute: penMinutes[i]!,
      stoppage: 0,
      team_id: side.team_id,
      player_id: side.kicker,
      related_player_id: null,
      type: 'penalty-goal',
      points: 3,
      x: penaltyKickX(),
      y: centreY(),
    });
  }
  // Drop goals: rare, spread across whole match.
  const dropMinutes = spreadMinutes(rng, side.dropGoals, 10, 78);
  for (let i = 0; i < dropMinutes.length; i++) {
    out.push({
      id: `${fixture.id}-drop-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute: dropMinutes[i]!,
      stoppage: 0,
      team_id: side.team_id,
      player_id: side.kicker,
      related_player_id: null,
      type: 'drop-goal',
      points: 3,
      x: dropGoalX(),
      y: centreY(),
    });
  }
}

interface SideCards {
  team_id: TeamId;
  yellows: number;
  reds: number;
  starters: readonly LineUpEntry[];
  isHome: boolean;
}

function addCardsForSide(
  rng: Rng,
  out: MatchEvent[],
  fixture: Fixture,
  side: SideCards,
): void {
  const idSuffix = side.isHome ? 'h' : 'a';
  // Yellow cards — scattered across whole match, slight second-half bias.
  const yellowMinutes = spreadMinutes(rng, side.yellows, 15, 75);
  for (let i = 0; i < yellowMinutes.length; i++) {
    out.push({
      id: `${fixture.id}-yc-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute: yellowMinutes[i]!,
      stoppage: 0,
      team_id: side.team_id,
      player_id: pickRandomStarter(rng, side.starters),
      related_player_id: null,
      type: 'yellow-card',
      points: 0,
      x: null,
      y: null,
    });
  }
  // Red cards — rare, second-half heavy.
  const redMinutes = spreadMinutes(rng, side.reds, 40, 78);
  for (let i = 0; i < redMinutes.length; i++) {
    out.push({
      id: `${fixture.id}-rc-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute: redMinutes[i]!,
      stoppage: 0,
      team_id: side.team_id,
      player_id: pickRandomStarter(rng, side.starters),
      related_player_id: null,
      type: 'red-card',
      points: 0,
      x: null,
      y: null,
    });
  }
}

interface SideCarries {
  team_id: TeamId;
  isHome: boolean;
  territoryPercent: number;
  starters: readonly LineUpEntry[];
}

/** Rugby convention: 30 sampled "carry" events per team per match — enough
 *  density for a kernel-smoothed heatmap without exploding the events
 *  table. Real feeds ship phase / tackle / carry events with coordinates;
 *  this stand-in mirrors that density and its distribution reflects the
 *  team's territorial share so the heatmap tells the match story. */
const CARRIES_PER_TEAM = 30;

function addCarriesForSide(
  rng: Rng,
  out: MatchEvent[],
  fixture: Fixture,
  side: SideCarries,
): void {
  const idSuffix = side.isHome ? 'h' : 'a';
  // X-centre biased by territorial share: a team with 60% territory has
  // a distribution centred deeper in the opposition half. Home attacks
  // right → centre shifts right when territory is high; away mirrors.
  const attackDir = side.isHome ? 1 : -1;
  const territoryOffset = ((side.territoryPercent - 50) / 100) * 0.4;
  const xCentre = 0.5 + attackDir * territoryOffset;
  // Standard deviations tuned empirically — wide enough to spread across
  // the pitch, narrow enough that the centre remains legible.
  const xSpread = 0.28;
  const ySpread = 0.32;

  for (let i = 0; i < CARRIES_PER_TEAM; i++) {
    // Two uniform samples averaged → rough triangular distribution around
    // the centre. Cheaper than Box-Muller and adequate for viz density.
    const xJitter = ((rng.next() + rng.next()) / 2 - 0.5) * xSpread * 2;
    const yJitter = ((rng.next() + rng.next()) / 2 - 0.5) * ySpread * 2;
    const x = Math.max(0.02, Math.min(0.98, xCentre + xJitter));
    const y = Math.max(0.05, Math.min(0.95, 0.5 + yJitter));
    const minute = rng.int(1, 79);
    out.push({
      id: `${fixture.id}-carry-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute,
      stoppage: 0,
      team_id: side.team_id,
      player_id: pickRandomStarter(rng, side.starters),
      related_player_id: null,
      type: 'carry',
      points: 0,
      x,
      y,
    });
  }
}

interface SideStats {
  team_id: TeamId;
  isHome: boolean;
  starters: readonly LineUpEntry[];
  tackles: number;
  lineBreaks: number;
  turnoversWon: number;
  tries: number;
}

/** Approximation of Opta per-player stat sheets. Each stat unit becomes a
 *  MatchEvent tagged with the player_id, so the same event-based
 *  `topByAggregation` used for scoring / carrying / cards keeps working
 *  for tackles / turnovers / line breaks / try assists at zero extra API
 *  surface. Distribution across the starting XV is weighted by role. */
function addStatEventsForSide(
  rng: Rng,
  out: MatchEvent[],
  fixture: Fixture,
  side: SideStats,
): void {
  const idSuffix = side.isHome ? 'h' : 'a';

  // Split the starting XV by role. Shirts 1–8 are forwards; 9–15 backs.
  const forwards = side.starters.filter((s) => s.shirt_number <= 8);
  const backs = side.starters.filter((s) => s.shirt_number >= 9);

  // Position-weighted distributions. Weights are per-metric because
  // tackles cluster on forwards and line breaks cluster on backs.
  const distribute = (
    count: number,
    forwardShare: number,
    type: MatchEventType,
    seq = 0,
  ): void => {
    // How many go to forwards vs backs given the split.
    let forwardCount = 0;
    let backCount = 0;
    for (let i = 0; i < count; i++) {
      const roll = rng.next();
      if (roll < forwardShare) forwardCount++;
      else backCount++;
    }
    const distributeInto = (players: readonly LineUpEntry[], units: number, group: string) => {
      if (players.length === 0) return;
      for (let i = 0; i < units; i++) {
        const player = players[Math.floor(rng.next() * players.length)]!;
        out.push({
          id: `${fixture.id}-${type}-${idSuffix}-${group}-${seq + i}`,
          fixture_id: fixture.id,
          // No specific minute — spread across the match uniformly.
          minute: rng.int(1, 79),
          stoppage: 0,
          team_id: side.team_id,
          player_id: player.player_id,
          related_player_id: null,
          type,
          points: 0,
          x: null,
          y: null,
        });
      }
    };
    distributeInto(forwards, forwardCount, 'f');
    distributeInto(backs, backCount, 'b');
  };

  // Position-weighted breakdown — mirrors typical rugby analytics splits.
  //   Tackles       — forward-heavy (locks / flankers / #8 do most of it).
  //   Turnovers won — forward-heavy (especially open-side flankers).
  //   Line breaks   — back-heavy (centres, wings, fullback break the line).
  //   Try assists   — back-heavy (fly-half, scrum-half, centres set up tries).
  distribute(side.tackles, 0.75, 'tackle');
  distribute(side.turnoversWon, 0.65, 'turnover-won');
  distribute(side.lineBreaks, 0.15, 'line-break');
  // Try assists — one assist per try scored, with the caveat that the
  // occasional try comes off a solo break (no assist). Approx 80% of
  // tries carry an assist.
  const tryAssists = Math.round(side.tries * 0.8);
  distribute(tryAssists, 0.15, 'try-assist');
}

interface SideSubs {
  team_id: TeamId;
  lineup: LineUp;
  isHome: boolean;
}

function addSubstitutions(
  rng: Rng,
  out: MatchEvent[],
  fixture: Fixture,
  side: SideSubs,
): void {
  const idSuffix = side.isHome ? 'h' : 'a';
  // Number of subs — most teams make 4-7 changes in a modern rugby test.
  const nSubs = Math.min(rng.int(4, 7), side.lineup.bench.length, side.lineup.starting_xv.length);
  // Pick which starters come off (unique) and pair with bench players in
  // shirt-number order (bench #16 → first sub off, etc.).
  const startersShuffled = rng.shuffle([...side.lineup.starting_xv]);
  const bench = [...side.lineup.bench].sort((a, b) => a.shirt_number - b.shirt_number);
  const subMinutes = spreadMinutes(rng, nSubs, 45, 75);
  for (let i = 0; i < nSubs; i++) {
    const starter = startersShuffled[i];
    const benchPlayer = bench[i];
    if (!starter || !benchPlayer) continue;
    out.push({
      id: `${fixture.id}-sub-${idSuffix}-${i}`,
      fixture_id: fixture.id,
      minute: subMinutes[i] ?? 60,
      stoppage: 0,
      team_id: side.team_id,
      player_id: starter.player_id, // coming OFF
      related_player_id: benchPlayer.player_id, // coming ON
      type: 'substitution',
      points: 0,
      x: null,
      y: null,
    });
  }
}

// ─── Coaching staff ──────────────────────────────────────────────────────────

/**
 * Canonical coaching-staff roles rendered per team. Head coach, one attack
 * coach, one defence coach, one forwards coach — the standard four-slot
 * international backroom. Skills / kicking coaches are optional; we skip
 * them here to keep the section short.
 */
const COACH_ROLES: readonly CoachRole[] = [
  'head-coach',
  'attack-coach',
  'defence-coach',
  'forwards-coach',
];

/**
 * Generate a fake coaching staff for a team. Names are drawn from the same
 * plausible-name pools used for players (PRD §5.5 — fake names attached to
 * fabricated attribution). No photos in v1; register #28 gates image rights.
 */
export function generateCoachingStaff(rng: Rng, teamId: TeamId): Coach[] {
  return COACH_ROLES.map((role, i) => {
    const first = FIRST_NAMES[Math.floor(rng.next() * FIRST_NAMES.length)] ?? 'Alex';
    const last = LAST_NAMES[Math.floor(rng.next() * LAST_NAMES.length)] ?? 'Coach';
    return {
      id: `${teamId}-coach-${i + 1}`,
      team_id: teamId,
      name: `${first} ${last}`,
      role,
    };
  });
}

// ─── Match officials ─────────────────────────────────────────────────────────

/**
 * Standard 4-slot match-official assignment: referee, two assistant
 * referees (sideline), and the TMO. Announced pre-match, so every fixture
 * (scheduled or completed) gets a full slate.
 */
const OFFICIAL_ROLES: readonly MatchOfficialRole[] = [
  'referee',
  'assistant-referee-1',
  'assistant-referee-2',
  'tmo',
];

export function generateMatchOfficials(rng: Rng, fixture: Fixture): MatchOfficial[] {
  return OFFICIAL_ROLES.map((role, i) => {
    const first = FIRST_NAMES[Math.floor(rng.next() * FIRST_NAMES.length)] ?? 'Alex';
    const last = LAST_NAMES[Math.floor(rng.next() * LAST_NAMES.length)] ?? 'Referee';
    return {
      id: `${fixture.id}-official-${i + 1}`,
      fixture_id: fixture.id,
      name: `${first} ${last}`,
      role,
    };
  });
}
