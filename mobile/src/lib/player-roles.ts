import type { Position } from '@rugby-app/shared';

import type { PlayerStatField } from '@/hooks/use-player-aggregate';

/** Appearance window for player-scoped reads — "prev. 10" by convention,
 *  matching the team-side form window. */
export const PLAYER_LOOKBACK = 10;

export const FORWARD_POSITIONS: readonly Position[] = [
  'loose-head-prop',
  'hooker',
  'tight-head-prop',
  'lock',
  'blindside-flanker',
  'openside-flanker',
  'number-8',
];

export const POSITION_LABELS: Record<Position, string> = {
  'loose-head-prop': 'Loosehead Prop',
  hooker: 'Hooker',
  'tight-head-prop': 'Tighthead Prop',
  lock: 'Lock',
  'blindside-flanker': 'Blindside Flanker',
  'openside-flanker': 'Openside Flanker',
  'number-8': 'Number 8',
  'scrum-half': 'Scrum-half',
  'fly-half': 'Fly-half',
  'left-wing': 'Left Wing',
  'inside-centre': 'Inside Centre',
  'outside-centre': 'Outside Centre',
  'right-wing': 'Right Wing',
  fullback: 'Fullback',
};

export const GROUP_LABELS: Record<string, string> = {
  'front-row': 'front-rowers',
  locks: 'locks',
  'back-row': 'back-rowers',
  'half-backs': 'half-backs',
  centres: 'centres',
  'back-three': 'back-three players',
};

export interface ScoutMetric {
  field: PlayerStatField;
  label: string;
  /** Lower is better — presentation flips the neutral percentile. */
  inverted?: boolean;
}

// Curated per-role scouting dimensions. A prop's kick metres are noise;
// a winger's lineout takes are noise — each role gets the eight
// dimensions scouts actually read for it. Shared by the Insights pane
// (percentile bars) and the Analysis narrative so both always describe
// the same profile.
export const FORWARD_SCOUT: readonly ScoutMetric[] = [
  { field: 'carries', label: 'Carries' },
  { field: 'metres_carried', label: 'Metres carried' },
  { field: 'tackles_made', label: 'Tackles' },
  { field: 'turnovers_won', label: 'Turnovers won' },
  { field: 'offloads', label: 'Offloads' },
  { field: 'rucks_hit', label: 'Rucks hit' },
  { field: 'lineout_takes', label: 'Lineout takes' },
  { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
];
export const BACK_SCOUT: readonly ScoutMetric[] = [
  { field: 'points', label: 'Points' },
  { field: 'tries', label: 'Tries' },
  { field: 'metres_carried', label: 'Metres carried' },
  { field: 'clean_breaks', label: 'Clean breaks' },
  { field: 'defenders_beaten', label: 'Defenders beaten' },
  { field: 'try_assists', label: 'Try assists' },
  { field: 'kick_metres', label: 'Kick metres' },
  { field: 'handling_errors', label: 'Handling errors', inverted: true },
];

/** One scouting category card — full-coverage complement to the
 *  curated role profiles above. */
export interface ScoutCategory {
  title: string;
  /** About copy for the card back. */
  purpose: string;
  metrics: readonly ScoutMetric[];
}

// Comprehensive scouting categories (owner call 2026-07-09): every
// PlayerMatchStats field the feed supplies (Opta RU7 floor + the two
// Superscout-backed counts), grouped by the schema's own taxonomy —
// nothing curated away. Zero rows still render (row permanence).
export const SCOUT_CATEGORIES: Record<string, ScoutCategory> = {
  scoring: {
    title: 'Scoring',
    purpose:
      'The scoreboard ledger — tries, the passes that made them and total points, per game against the average player in his position.',
    metrics: [
      { field: 'tries', label: 'Tries' },
      { field: 'try_assists', label: 'Try assists' },
      { field: 'points', label: 'Points' },
    ],
  },
  attack: {
    title: 'Attack',
    purpose:
      'The with-ball engine — volume, metres and what the carries broke, per game against the average player in his position. On handling errors the lower number wins the green.',
    metrics: [
      { field: 'carries', label: 'Carries' },
      { field: 'metres_carried', label: 'Metres carried' },
      { field: 'clean_breaks', label: 'Clean breaks' },
      { field: 'defenders_beaten', label: 'Defenders beaten' },
      { field: 'offloads', label: 'Offloads' },
      { field: 'passes', label: 'Passes' },
      { field: 'handling_errors', label: 'Handling errors', inverted: true },
    ],
  },
  kicking: {
    title: 'Kicking',
    purpose:
      'The boot — goal kicks landed, kicks from hand and the metres they bought, per game against the average player in his position.',
    metrics: [
      { field: 'conversions', label: 'Conversions' },
      { field: 'penalty_goals', label: 'Penalty goals' },
      { field: 'drop_goals', label: 'Drop goals' },
      { field: 'kicks_from_hand', label: 'Kicks from hand' },
      { field: 'kick_metres', label: 'Kick metres' },
    ],
  },
  defence: {
    title: 'Defence',
    purpose:
      'The denying numbers — tackle volume, the ones that slipped and the ball stolen back, per game against the average player in his position. On missed tackles the lower number wins the green.',
    metrics: [
      { field: 'tackles_made', label: 'Tackles made' },
      { field: 'missed_tackles', label: 'Missed tackles', inverted: true },
      { field: 'turnovers_won', label: 'Turnovers won' },
    ],
  },
  contest: {
    title: 'Breakdown & Set-Piece',
    purpose:
      'The contest work — ruck arrivals, lineout ball won and lineout ball stolen, per game against the average player in his position.',
    metrics: [
      { field: 'rucks_hit', label: 'Rucks hit' },
      { field: 'lineout_takes', label: 'Lineout takes' },
      { field: 'lineout_steals', label: 'Lineout steals' },
    ],
  },
  discipline: {
    title: 'Discipline',
    purpose:
      'The giveaway ledger — penalties and cards, per game against the average player in his position. The lower number wins the green on every row.',
    metrics: [
      { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
      { field: 'yellow_cards', label: 'Yellow cards', inverted: true },
      { field: 'red_cards', label: 'Red cards', inverted: true },
    ],
  },
};

// Category order leads with the role's bread and butter — forwards
// read contact-first, backs read strike-first. Same six cards either
// way (row permanence at card scale).
export const FORWARD_CATEGORY_ORDER = [
  'attack',
  'defence',
  'contest',
  'scoring',
  'kicking',
  'discipline',
] as const;
export const BACK_CATEGORY_ORDER = [
  'attack',
  'scoring',
  'kicking',
  'defence',
  'contest',
  'discipline',
] as const;

// Role-based trend metrics for the Form sparklines.
export const FORWARD_TREND: readonly { field: PlayerStatField; label: string }[] = [
  { field: 'tackles_made', label: 'Tackles' },
  { field: 'carries', label: 'Carries' },
  { field: 'metres_carried', label: 'Metres' },
];
export const BACK_TREND: readonly { field: PlayerStatField; label: string }[] = [
  { field: 'metres_carried', label: 'Metres' },
  { field: 'defenders_beaten', label: 'Defenders beaten' },
  { field: 'points', label: 'Points' },
];
