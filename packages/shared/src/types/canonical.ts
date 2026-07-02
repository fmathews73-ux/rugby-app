/**
 * Canonical types for the rugby app's internal data model.
 *
 * Feed-agnostic by design: no field is named after any specific data provider
 * (Sportradar, Opta, Highlightly, etc). Every adapter — the synthetic dev
 * adapter (PRD §5.5), the future aggregator adapter, and the eventual premium
 * adapter — emits these shapes. Swapping data sources is a config change, not
 * a rewrite (PRD §5.1, §6.1 step 2).
 *
 * v1 scope: Men's Tier 1 Internationals, current season only
 * (PRD §3.4 RESOLVED v0.4).
 *
 * Owner-defined stable IDs (see services/pipeline/CLAUDE.md principle #3):
 * never use vendor IDs as canonical primary keys; maintain a vendor↔canonical
 * crosswalk inside adapters only.
 */

// ─── ID string aliases ───────────────────────────────────────────────────────
// Plain string aliases are used instead of branded types to keep the surface
// simple. Promote to branded types (via a `& { readonly __brand: '...' }` tag)
// if we start hitting bugs from swapped IDs.

export type CompetitionId = string;
export type SeasonId = string;
export type TeamId = string;
export type PlayerId = string;
export type FixtureId = string;
export type SquadId = string;
export type StandingsId = string;
export type BracketId = string;
export type RankingSnapshotId = string;

// ─── Time ────────────────────────────────────────────────────────────────────
// ISO 8601 strings, kept as aliases for documentation. Storage and API JSON
// carry the string; UI code parses as needed.

export type IsoDate = string; // 'YYYY-MM-DD'
export type IsoDateTime = string; // 'YYYY-MM-DDTHH:mm:ssZ'

// ─── Enums (as string-literal unions) ────────────────────────────────────────

export type CompetitionFormat =
  | 'round-robin' // Six Nations, Rugby Championship
  | 'test-window' // Autumn / summer test series — a set of independent tests
  | 'pool-and-knockout'; // World Cup — pool stage (round-robin) → knockouts

export type CompetitionStatus = 'upcoming' | 'live' | 'completed';

export type FixtureStatus =
  | 'scheduled'
  | 'live'
  | 'half-time'
  | 'completed'
  | 'postponed'
  | 'cancelled';

/**
 * The 15 starting positions in Rugby Union. Bench forwards may cover multiple
 * positions in practice; `primary_position` on Player is the position on the
 * squad list, `position` on LineUpEntry is the position played for that fixture.
 */
export type Position =
  | 'loose-head-prop' // 1
  | 'hooker' // 2
  | 'tight-head-prop' // 3
  | 'lock' // 4, 5
  | 'blindside-flanker' // 6
  | 'openside-flanker' // 7
  | 'number-8' // 8
  | 'scrum-half' // 9
  | 'fly-half' // 10
  | 'left-wing' // 11
  | 'inside-centre' // 12
  | 'outside-centre' // 13
  | 'right-wing' // 14
  | 'fullback'; // 15

// ─── Core entities ───────────────────────────────────────────────────────────

/**
 * A tournament identity (not a specific edition). Editions are Seasons.
 * v1 competitions: `six-nations`, `rugby-championship`, `autumn-tests`,
 * `summer-tests`, `world-cup`.
 */
export interface Competition {
  id: CompetitionId;
  name: string; // 'Six Nations'
  short_name: string; // 'Six Nations'
  format: CompetitionFormat;
  governing_body: string; // 'World Rugby', 'Six Nations Rugby', etc.
}

/**
 * One edition of a Competition. In v1 we carry only the current season per
 * competition (register #4 RESOLVED v0.4).
 */
export interface Season {
  id: SeasonId;
  competition_id: CompetitionId;
  year_label: string; // '2026', '2026-27' — freeform for calendar-straddling comps
  start_date: IsoDate;
  end_date: IsoDate;
  status: CompetitionStatus;
}

/**
 * A national team. Names are public identifiers (not licensable). Crests and
 * logos MUST NOT be represented as image URLs pointing at real assets — root
 * CLAUDE.md §9. `primary_color` is a neutral placeholder until the design
 * system decision (register #23 resolved: neutral placeholders).
 */
export interface Team {
  id: TeamId;
  name: string; // 'New Zealand'
  short_name: string; // 'NZL' — World Rugby 3-letter code
  primary_color: string; // '#XXXXXX' neutral placeholder — do NOT use official kit colours
  /**
   * flagcdn.com identifier used to fetch the national flag PNG:
   * https://flagcdn.com/w{size}/{flag_code}.png
   * ISO 3166-1 alpha-2 for sovereign nations ('nz', 'fr'), or the
   * hyphenated subdivision code for constituent countries ('gb-eng',
   * 'gb-sct', 'gb-wls'). Flags — unlike crests — are public identifiers
   * and are allowed by root CLAUDE.md §9 (v0.5).
   */
  flag_code: string;
}

/**
 * A player. In synthetic dev builds `name` is plausibly fake — never a real
 * player tied to fabricated stats (PRD §5.5).
 */
export interface Player {
  id: PlayerId;
  team_id: TeamId;
  name: string; // synthetic: fake; real: from licensed feed
  primary_position: Position;
  date_of_birth: IsoDate;
  height_cm: number;
  weight_kg: number;
  cap_count: number; // synthetic during dev; feed-supplied in prod
}

/**
 * A team's roster for a specific season. Different competitions in the same
 * calendar year can have different squads (Six Nations vs. autumn tests, etc).
 */
export interface Squad {
  id: SquadId;
  team_id: TeamId;
  season_id: SeasonId;
  player_ids: PlayerId[];
}

/**
 * A single match.
 */
export interface Fixture {
  id: FixtureId;
  competition_id: CompetitionId;
  season_id: SeasonId;
  round: string | null; // 'Round 1', 'Semi-final', or null for a test window
  home_team_id: TeamId;
  away_team_id: TeamId;
  kickoff_utc: IsoDateTime;
  venue: string; // stadium name — public info
  status: FixtureStatus;
}

/**
 * Match-level aggregate result. Only exists when Fixture.status is 'completed'
 * (or 'live' with partial values). Player-level per-match stats are register
 * #12 (Stats KPI field list, INPUT NEEDED — Phase 2) — not modelled yet.
 *
 * Team-level stats broaden the surface in v0.5+: possession / territory /
 * carry / set-piece / defence / discipline counts. Advanced player-level
 * splits (dominant tackles, ruck retention %, carries into contact, etc.)
 * are behind the premium gate and NOT modelled here yet.
 */
export interface Result {
  fixture_id: FixtureId;
  home_score: number;
  away_score: number;

  half_time_home: number;
  half_time_away: number;

  home_tries: number;
  away_tries: number;
  home_conversions: number;
  away_conversions: number;
  home_penalties: number;
  away_penalties: number;
  home_drop_goals: number;
  away_drop_goals: number;

  /** Percentage of ball possession (0-100). home + away always sums to 100. */
  home_possession_percent: number;
  away_possession_percent: number;
  /** Percentage of time the ball spent in the opponent's half (0-100).
   * home + away sums to 100. */
  home_territory_percent: number;
  away_territory_percent: number;

  home_meters: number;
  away_meters: number;
  home_line_breaks: number;
  away_line_breaks: number;
  home_kicks_in_play: number;
  away_kicks_in_play: number;

  home_scrums_won: number;
  away_scrums_won: number;
  home_lineouts_won: number;
  away_lineouts_won: number;

  home_tackles_made: number;
  away_tackles_made: number;
  home_turnovers_won: number;
  away_turnovers_won: number;

  /** Penalties given away (fouls), NOT penalty goals scored. */
  home_penalties_conceded: number;
  away_penalties_conceded: number;
}

/**
 * Starting XV + bench for one side in one fixture.
 */
export interface LineUp {
  fixture_id: FixtureId;
  team_id: TeamId;
  starting_xv: LineUpEntry[];
  bench: LineUpEntry[];
}

export interface LineUpEntry {
  shirt_number: number; // 1-15 starting, 16-23 bench
  player_id: PlayerId;
  position: Position; // position played for this fixture
}

// ─── Standings (round-robin) ─────────────────────────────────────────────────

/**
 * League table for round-robin competitions (Six Nations, Rugby Championship)
 * and the pool stage of the World Cup.
 */
export interface Standings {
  id: StandingsId;
  competition_id: CompetitionId;
  season_id: SeasonId;
  group: string | null; // 'Pool A' etc. for pool-and-knockout comps; null for straight round-robin
  rows: StandingsRow[];
}

export interface StandingsRow {
  team_id: TeamId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_for: number;
  points_against: number;
  points_difference: number;
  try_bonus_points: number; // 1 point for scoring 4+ tries
  losing_bonus_points: number; // 1 point for losing by <= 7
  table_points: number; // total tournament points (win = 4, draw = 2, plus bonuses)
  rank: number;
}

// ─── Bracket (knockout) ──────────────────────────────────────────────────────

/**
 * Knockout tree for pool-and-knockout competitions (World Cup).
 */
export interface Bracket {
  id: BracketId;
  competition_id: CompetitionId;
  season_id: SeasonId;
  rounds: BracketRound[];
}

export interface BracketRound {
  name: string; // 'Round of 16', 'Quarter-final', 'Semi-final', 'Bronze final', 'Final'
  fixture_ids: FixtureId[];
}

// ─── Rankings (Power Rankings — Internationals) ──────────────────────────────

/**
 * A World Rugby ranking snapshot at a point in time. Stored, not computed
 * (PRD §7). In synthetic dev builds these are fake values on real team ids.
 */
export interface RankingSnapshot {
  id: RankingSnapshotId;
  source: 'world-rugby-mens'; // v1 has this single source only
  snapshot_date: IsoDate;
  rows: RankingRow[];
}

export interface RankingRow {
  rank: number;
  team_id: TeamId;
  points: number;
  previous_rank: number | null;
  movement: number | null; // rank_delta since previous snapshot; null if none
}
