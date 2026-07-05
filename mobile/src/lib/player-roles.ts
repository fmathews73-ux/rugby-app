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
