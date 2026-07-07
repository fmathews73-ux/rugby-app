import type { Ionicons } from '@expo/vector-icons';

import type { MatchEvent } from '@rugby-app/shared';

/**
 * Scoring-event icon markers shared by the match timeline charts
 * (Momentum, Scoring Progression): tries, conversions and penalty
 * goals drawn as bare 10pt icons in a home strip (below the period
 * labels) and an away strip (above the minute labels).
 */
export interface ScoringMarker {
  minute: number;
  side: 'home' | 'away';
  type: 'try' | 'conversion' | 'penalty-goal';
}

export const MARKER_ICON: Record<ScoringMarker['type'], keyof typeof Ionicons.glyphMap> = {
  try: 'american-football',
  conversion: 'add-circle-outline',
  'penalty-goal': 'flag-outline',
};

export const MARKER_ICON_SIZE = 10;

export function buildScoringMarkers(
  events: readonly MatchEvent[],
  homeTeamId: string,
): ScoringMarker[] {
  return events
    .filter(
      (e): e is MatchEvent & { team_id: string } =>
        (e.type === 'try' || e.type === 'conversion' || e.type === 'penalty-goal') &&
        e.team_id !== null,
    )
    .map((e) => ({
      minute: e.minute,
      side: e.team_id === homeTeamId ? ('home' as const) : ('away' as const),
      type: e.type as ScoringMarker['type'],
    }));
}

export interface PlacedMarker {
  x: number;
  y: number;
  type: ScoringMarker['type'];
  side: ScoringMarker['side'];
}

/**
 * Lay markers out along the minute scale. Same-minute events on one
 * side (try + conversion) sidestep horizontally within their band
 * rather than stacking into the axis labels.
 */
export function placeScoringMarkers(
  markers: readonly ScoringMarker[],
  xForMinute: (minute: number) => number,
  homeY: number,
  awayY: number,
  maxMinute = Number.POSITIVE_INFINITY,
): PlacedMarker[] {
  const placed: PlacedMarker[] = [];
  const visible = [...markers]
    .filter((mk) => mk.minute <= maxMinute)
    .sort((a, b) => a.minute - b.minute);
  for (const mk of visible) {
    const x = xForMinute(mk.minute) - MARKER_ICON_SIZE / 2;
    const cluster = placed.filter(
      (q) => q.side === mk.side && Math.abs(q.x - x) < 12,
    ).length;
    placed.push({
      x: x + cluster * (MARKER_ICON_SIZE + 2),
      y: mk.side === 'home' ? homeY : awayY,
      type: mk.type,
      side: mk.side,
    });
  }
  return placed;
}
