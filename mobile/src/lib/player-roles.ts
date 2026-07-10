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

/** Peer pools for positional comparison — a prop's numbers are only
 *  meaningful against other front-rowers. Mirrors the server's
 *  percentile grouping. */
export const POSITION_GROUP_MEMBERS: Record<string, readonly Position[]> = {
  'front-row': ['loose-head-prop', 'hooker', 'tight-head-prop'],
  locks: ['lock'],
  'back-row': ['blindside-flanker', 'openside-flanker', 'number-8'],
  'half-backs': ['scrum-half', 'fly-half'],
  centres: ['inside-centre', 'outside-centre'],
  'back-three': ['left-wing', 'right-wing', 'fullback'],
};

export function positionGroupOf(position: Position): string {
  for (const [group, members] of Object.entries(POSITION_GROUP_MEMBERS)) {
    if (members.includes(position)) return group;
  }
  return 'back-three';
}

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

// Radar dimensions — the six lobes of the player Profile radar, each
// a composite of display percentiles. Independent of the CARD deck
// (owner call 2026-07-10: cards regrouped for balance, lobes keep the
// six-department shape).
export const RADAR_DIMENSIONS: readonly {
  key: string;
  label: string;
  metrics: readonly ScoutMetric[];
}[] = [
  { key: 'scoring', label: 'Scoring', metrics: [
    { field: 'tries', label: 'Tries' },
    { field: 'try_assists', label: 'Try assists' },
    { field: 'points', label: 'Points' },
  ] },
  { key: 'attack', label: 'Attack', metrics: [
    { field: 'carries', label: 'Carries' },
    { field: 'metres_carried', label: 'Metres carried' },
    { field: 'clean_breaks', label: 'Clean breaks' },
    { field: 'defenders_beaten', label: 'Defenders beaten' },
    { field: 'offloads', label: 'Offloads' },
    { field: 'passes', label: 'Passes' },
    { field: 'handling_errors', label: 'Handling errors', inverted: true },
  ] },
  { key: 'kicking', label: 'Kicking', metrics: [
    { field: 'conversions', label: 'Conversions' },
    { field: 'penalty_goals', label: 'Penalty goals' },
    { field: 'drop_goals', label: 'Drop goals' },
    { field: 'kicks_from_hand', label: 'Kicks from hand' },
    { field: 'kick_metres', label: 'Kick metres' },
  ] },
  { key: 'defence', label: 'Defence', metrics: [
    { field: 'tackles_made', label: 'Tackles made' },
    { field: 'missed_tackles', label: 'Missed tackles', inverted: true },
    { field: 'turnovers_won', label: 'Turnovers won' },
  ] },
  { key: 'contest', label: 'Breakdown', metrics: [
    { field: 'rucks_hit', label: 'Rucks hit' },
    { field: 'lineout_takes', label: 'Lineout takes' },
    { field: 'lineout_steals', label: 'Lineout steals' },
  ] },
  { key: 'discipline', label: 'Discipline', metrics: [
    { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
    { field: 'yellow_cards', label: 'Yellow cards', inverted: true },
    { field: 'red_cards', label: 'Red cards', inverted: true },
  ] },
];

/** One scouting category card. */
export interface ScoutCategory {
  title: string;
  /** About copy for the card back. */
  purpose: string;
  metrics: readonly ScoutMetric[];
}

// The card DECK — four balanced cards (owner call 2026-07-10: the
// 3-row cards drowned in white space), max SEVEN rows each (the
// 416pt anchor's ceiling), all 24 feed-backed fields present.
export const SCOUT_CATEGORIES: Record<string, ScoutCategory> = {
  scoring: {
    title: 'Scoring',
    purpose:
      'Every way the points arrive — tries, the passes that made them, and the goal kicks landed — per game against the average player in his position.',
    metrics: [
      { field: 'tries', label: 'Tries' },
      { field: 'try_assists', label: 'Try assists' },
      { field: 'points', label: 'Points' },
      { field: 'conversions', label: 'Conversions' },
      { field: 'penalty_goals', label: 'Penalty goals' },
      { field: 'drop_goals', label: 'Drop goals' },
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
  contest: {
    title: 'Defence & Breakdown',
    purpose:
      'The contact contest — tackle volume and the ones that slipped, plus the ball won at ruck and lineout, per game against the average player in his position. On missed tackles the lower number wins the green.',
    metrics: [
      { field: 'tackles_made', label: 'Tackles made' },
      { field: 'missed_tackles', label: 'Missed tackles', inverted: true },
      { field: 'turnovers_won', label: 'Turnovers won' },
      { field: 'rucks_hit', label: 'Rucks hit' },
      { field: 'lineout_takes', label: 'Lineout takes' },
      { field: 'lineout_steals', label: 'Lineout steals' },
    ],
  },
  management: {
    title: 'Game Management',
    purpose:
      'The boot and the whistle — kicks from hand and the metres they bought, against the penalties and cards given away, per game against the average player in his position. On the giveaway rows the lower number wins the green.',
    metrics: [
      { field: 'kicks_from_hand', label: 'Kicks from hand' },
      { field: 'kick_metres', label: 'Kick metres' },
      { field: 'penalties_conceded', label: 'Penalties conceded', inverted: true },
      { field: 'yellow_cards', label: 'Yellow cards', inverted: true },
      { field: 'red_cards', label: 'Red cards', inverted: true },
    ],
  },
};

// Deck order leads with the role's bread and butter — forwards read
// contact-first, backs read strike-first.
export const FORWARD_CATEGORY_ORDER = [
  'attack',
  'contest',
  'scoring',
  'management',
] as const;
export const BACK_CATEGORY_ORDER = [
  'attack',
  'scoring',
  'management',
  'contest',
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
