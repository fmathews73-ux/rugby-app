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
export type MatchEventId = string;
export type CoachId = string;
export type MatchOfficialId = string;

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
 * Coaching-staff role — the canonical set of coaching positions modelled in
 * v1. Real feeds may or may not carry coaching data (PRD register #7); if
 * absent at Phase 6 cutover, the coaching-staff endpoint returns an empty
 * array and the UI section hides itself.
 */
export type CoachRole =
  | 'head-coach'
  | 'assistant-coach'
  | 'attack-coach'
  | 'defence-coach'
  | 'forwards-coach'
  | 'skills-coach'
  | 'kicking-coach';

/**
 * A coaching-staff member associated with a team. Names in dev are
 * plausibly-fake per PRD §5.5 (no real coaches attributed to fabricated
 * stats). No photos in v1 — coaching-staff photos are bundled with the
 * provider's image-rights licence tier (register #28).
 */
export interface Coach {
  id: CoachId;
  team_id: TeamId;
  name: string;
  role: CoachRole;
}

/**
 * Match-official role — the four canonical officiating positions in a
 * modern rugby test: on-field referee, two assistant referees ("sideline"
 * officials in broadcast parlance), and the TMO (Television Match
 * Official). Announced pre-match per WR competition rules, so officials
 * data is available even for scheduled fixtures.
 */
export type MatchOfficialRole =
  | 'referee'
  | 'assistant-referee-1'
  | 'assistant-referee-2'
  | 'tmo';

/**
 * A single match official assigned to a fixture. Fixture-scoped (not
 * team-scoped) since officials are neutral. Names in dev are plausibly
 * fake per PRD §5.5.
 */
export interface MatchOfficial {
  id: MatchOfficialId;
  fixture_id: FixtureId;
  name: string;
  role: MatchOfficialRole;
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

  // Attack
  home_meters: number;
  away_meters: number;
  home_line_breaks: number;
  away_line_breaks: number;
  home_carries: number;
  away_carries: number;
  home_passes: number;
  away_passes: number;
  home_offloads: number;
  away_offloads: number;

  // Kicking
  home_kicks_in_play: number;
  away_kicks_in_play: number;
  home_kicks_to_touch: number;
  away_kicks_to_touch: number;
  home_kick_meters: number;
  away_kick_meters: number;
  /** Contestable kicks PUT UP by each side (box kicks, bombs,
   * cross-kicks contested in the air). A kick delivered by one side is
   * received by the other, so reception numbers derive: home
   * receptions = away_contestable_kicks; home receptions won =
   * away_contestable_kicks − away_contestable_kicks_won. */
  home_contestable_kicks: number;
  away_contestable_kicks: number;
  /** Of the side's OWN contestable kicks, how many it regathered. */
  home_contestable_kicks_won: number;
  away_contestable_kicks_won: number;

  // Set piece
  home_scrums_won: number;
  away_scrums_won: number;
  home_scrums_lost: number;
  away_scrums_lost: number;
  home_lineouts_won: number;
  away_lineouts_won: number;
  home_lineouts_lost: number;
  away_lineouts_lost: number;

  // Breakdown — rucks are the possession-retention engine of the modern
  // game; mauls the lineout-drive weapon. Won/lost pairs so success
  // rates are derivable without extra fields.
  home_rucks_won: number;
  away_rucks_won: number;
  home_rucks_lost: number;
  away_rucks_lost: number;
  home_mauls_won: number;
  away_mauls_won: number;
  home_mauls_lost: number;
  away_mauls_lost: number;

  // Attack (extended)
  home_defenders_beaten: number;
  away_defenders_beaten: number;
  /** 50/22 kicks landed — rare (0-2 per match) but high narrative value. */
  home_fifty_twenty_twos: number;
  away_fifty_twenty_twos: number;

  // Red zone — the Opta "visits to the 22" pair. Points-per-entry (PPE)
  // is derived (points_from / entries), both attacking and defensive
  // (opponent's pair), so no ratio field is stored.
  home_twenty_two_entries: number;
  away_twenty_two_entries: number;
  /** Points scored from possessions inside the opposition 22. Always ≤ score. */
  home_points_from_twenty_two_entries: number;
  away_points_from_twenty_two_entries: number;

  // Goal kicking — attempts alongside the made counts already stored
  // (conversions / penalties), so kicking success % is derivable.
  /** Conversion attempts. Equals tries except when a kick is declined/timed out. */
  home_conversion_attempts: number;
  away_conversion_attempts: number;
  /** Shots at goal from penalties (made + missed). ≥ penalties (made). */
  home_penalty_goal_attempts: number;
  away_penalty_goal_attempts: number;

  // ─── Advanced tier ─────────────────────────────────────────────────
  // Premium-feed metrics (aggregator advanced tier). Modelled at TEAM
  // level only; player-level advanced splits stay out until the Phase 6
  // licence confirms them. All serve the premium-gated Stats surface.
  /** Metres made after first contact. Always ≤ total metres. */
  home_post_contact_metres: number;
  away_post_contact_metres: number;
  /** Share of carries that crossed the gainline (0-100). */
  home_gainline_success_percent: number;
  away_gainline_success_percent: number;
  /** Tackles that drove the carrier backwards. */
  home_dominant_tackles: number;
  away_dominant_tackles: number;
  /** Share of attacking rucks recycled inside 3 seconds (0-100) — the
   *  standard "quick ball" read. */
  home_ruck_speed_0_3s_percent: number;
  away_ruck_speed_0_3s_percent: number;
  /** Penalty-cause split. The three primary causes; they sum to less
   *  than penalties_conceded (remainder = other offences). */
  home_scrum_penalties_conceded: number;
  away_scrum_penalties_conceded: number;
  home_breakdown_penalties_conceded: number;
  away_breakdown_penalties_conceded: number;
  home_offside_penalties_conceded: number;
  away_offside_penalties_conceded: number;

  // Defence
  home_tackles_made: number;
  away_tackles_made: number;
  /** Whole-number percentage 0-100. */
  home_tackle_success_percent: number;
  away_tackle_success_percent: number;
  home_turnovers_won: number;
  away_turnovers_won: number;
  home_turnovers_conceded: number;
  away_turnovers_conceded: number;

  // Discipline
  /** Penalties given away (fouls), NOT penalty goals scored. */
  home_penalties_conceded: number;
  away_penalties_conceded: number;
  home_handling_errors: number;
  away_handling_errors: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_red_cards: number;
  away_red_cards: number;
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

/**
 * Server-computed percentile read-model for one player against their
 * position-group peers. Percentiles are NEUTRAL: they express the share
 * of peers at or below the player's per-80 value (higher raw value →
 * higher percentile), with NO good/bad inversion applied — clients flip
 * presentation for lower-is-better metrics (discipline etc.) themselves.
 * Peers qualify with a minimum number of appearances in the window so
 * tiny samples don't pollute the distribution.
 */
export interface PlayerPercentiles {
  player_id: PlayerId;
  /** Position-group key the peer pool was drawn from, e.g. 'back-row'. */
  position_group: string;
  /** Window size requested (most recent N appearances per player). */
  lookback: number;
  /** The subject's appearances inside the window. */
  appearances: number;
  /** Qualifying peer-pool size, subject included. */
  peers: number;
  metrics: {
    /** PlayerMatchStats numeric field name, e.g. 'tackles_made'. */
    field: string;
    /** The subject's per-80-minute rate over the window. */
    per80: number;
    /** 0–100. Share of the peer pool at or below the subject's rate. */
    percentile: number;
    /** The subject's per-GAME average over the window — the fan-facing
     *  rate (per-80 stays for the analyst columns). */
    per_game: number;
    /** Peer-pool mean of the per-game averages — the "average peer"
     *  reference the profile bars run against. */
    peer_avg: number;
  }[];
}

/**
 * Per-player per-match stat sheet — mirrors the shape an aggregator feed
 * supplies for a completed fixture (one sheet per player in either matchday
 * 23). Only exists for completed fixtures; scheduled / live fixtures have no
 * sheets. Event-derived counts (tries, tackles, cards, …) reconcile exactly
 * with the fixture's MatchEvent timeline, and side-level sums reconcile with
 * the fixture's Result totals.
 */
export interface PlayerMatchStats {
  fixture_id: FixtureId;
  team_id: TeamId;
  player_id: PlayerId;
  // Participation
  started: boolean;
  minutes_played: number;
  // Attacking
  tries: number;
  try_assists: number;
  points: number;
  carries: number;
  metres_carried: number;
  clean_breaks: number;
  defenders_beaten: number;
  offloads: number;
  passes: number;
  handling_errors: number;
  // Kicking
  conversions: number;
  penalty_goals: number;
  drop_goals: number;
  kicks_from_hand: number;
  kick_metres: number;
  // Defence
  tackles_made: number;
  missed_tackles: number;
  turnovers_won: number;
  // Breakdown / set piece
  rucks_hit: number;
  lineout_takes: number;
  lineout_steals: number;
  // Discipline
  penalties_conceded: number;
  yellow_cards: number;
  red_cards: number;
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
  /**
   * Ranking source. Men's and women's are the two active World Rugby-published
   * ranking systems (register #3 flipped 2026-07-02 — women's brought into v1
   * scope alongside men's). Both are stored, not computed (PRD §7).
   */
  source: 'world-rugby-mens' | 'world-rugby-womens';
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

// ─── Match events (Overview timeline) ────────────────────────────────────────

/**
 * A single moment in a match's chronological timeline. Rendered as the
 * fixture Overview pane's event feed (try, card, sub, half-time, etc.).
 * Live-fed in prod; synthesised for dev builds reconciled to the fixture's
 * `Result` so tries × 5 + conversions × 2 + penalty-goals × 3 +
 * drop-goals × 3 always sums to the final score already on record.
 *
 * Milestones (kick-off, half-time, second-half-start, full-time) have no
 * associated team / player. All other event types carry at least a team_id
 * and typically a player_id.
 *
 * Substitutions encode both sides of the swap: `player_id` is the player
 * coming OFF, `related_player_id` is the player coming ON.
 */
export type MatchEventType =
  // Scoring — carry associated points via the `points` field.
  | 'try'
  | 'conversion'
  | 'penalty-goal'
  | 'drop-goal'
  // Positional play sample — synthesized in dev to power the pitch
  // heatmap. A "carry" represents ball-in-hand play at (x, y). Real feeds
  // ship per-phase / per-tackle events with coords; carries are our
  // stand-in until cutover.
  | 'carry'
  // Per-player stat events. Each fires once per corresponding stat unit
  // (one 'tackle' event per tackle made, one 'line-break' per line break,
  // etc.) so downstream aggregations just count matching events by
  // player_id. Real feeds (Opta / Stats Perform) ship stat sheets rather
  // than per-unit events, but this event-shaped stand-in keeps the same
  // consumer API — `topByAggregation(events, teamId, matcher)`.
  | 'tackle'
  | 'turnover-won'
  | 'line-break'
  | 'try-assist'
  // Discipline.
  | 'yellow-card'
  | 'red-card'
  // Substitutions — `player_id` off, `related_player_id` on.
  | 'substitution'
  // Whole-match milestones.
  | 'kick-off'
  | 'half-time'
  | 'second-half-start'
  | 'full-time';

export interface MatchEvent {
  id: MatchEventId;
  fixture_id: FixtureId;
  /** Whole-number match minute (0 = kick-off, 40 = half-time,
   *  80 = full-time). For events during stoppage time, use the base minute
   *  (e.g. 40) plus `stoppage`. */
  minute: number;
  /** Stoppage minutes on top of `minute` — e.g. 40 + stoppage 2 renders
   *  as "40'+2'". 0 for regular time. */
  stoppage: number;
  /** Team the event belongs to. Null for match milestones (kick-off,
   *  half-time, etc.) that are not team-specific. */
  team_id: TeamId | null;
  /** Primary player. Null for milestones. For substitutions this is the
   *  player coming OFF. */
  player_id: PlayerId | null;
  /** Related player, currently only used for substitutions — the player
   *  coming ON. Null otherwise. */
  related_player_id: PlayerId | null;
  type: MatchEventType;
  /** Points scored by this event (0 for non-scoring events). Try = 5,
   *  Conversion = 2, Penalty goal = 3, Drop goal = 3. Explicit rather
   *  than derived so consumers don't have to hard-code the scoring table. */
  points: number;
  /** Normalised pitch x-coordinate (0..1). Origin is the LEFT try line as
   *  viewed from a broadcast camera behind the home team; 1 is the RIGHT
   *  try line. Null when the event isn't tied to a specific point on the
   *  pitch (milestones, cards, substitutions). */
  x: number | null;
  /** Normalised pitch y-coordinate (0..1). 0 = one touchline, 1 = the
   *  other; the two are interchangeable and depend on camera orientation.
   *  Null under the same conditions as `x`. */
  y: number | null;
}
