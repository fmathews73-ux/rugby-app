import { useMemo } from 'react';

import type { Fixture, MatchEvent, MatchEventType } from '@rugby-app/shared';

import { useFixture, useFixtureEvents } from '@/api/hooks';

/** One sample on the momentum timeline — the signed net attacking
 *  momentum (home minus away) at a given match minute. Positive means
 *  home has the initiative in that window; negative means away does. */
export interface MomentumSample {
  minute: number;
  /** Signed net weight: home weighted attacking events minus away
   *  weighted attacking events, both summed in the trailing
   *  `WINDOW_MINUTES` window ending at `minute`. Zero means both sides
   *  are equally active (contested phase) or neither is active. */
  net: number;
}

/** Trailing window (in match minutes). Short window + broad event set
 *  produces the frequent, sharp peaks characteristic of the Opta-style
 *  attacking-momentum mirror chart. Bumping this smooths / flattens the
 *  signal; shrinking makes it more spiky. */
const WINDOW_MINUTES = 2;

/**
 * Attacking-momentum event weights. Broader than "scoring events only"
 * so the chart shows continuous ebb-and-flow rather than sparse plateaus
 * between the ~6 scoring events per team. Weights are chosen so that
 * scoring events dominate (a try is the peak) while carries / line
 * breaks provide the base signal.
 *
 * Tackles are intentionally excluded — they're defensive activity
 * (team A tackling means team B is attacking), and including them would
 * blur the "who is on the front foot right now" story.
 *
 * Cards and milestone events don't contribute (moment-in-time, not
 * ongoing attacking momentum).
 */
const EVENT_WEIGHTS: Partial<Record<MatchEventType, number>> = {
  try: 10,
  'try-assist': 5,
  'line-break': 5,
  'turnover-won': 4,
  'penalty-goal': 6,
  conversion: 3,
  'drop-goal': 6,
  carry: 1,
};

/** Full 80-minute match canvas — sampled at every minute (81 points). */
const TOTAL_MINUTES = 80;

/**
 * Per-minute rolling scoring density for each side across the full 80'
 * match canvas. Powers the Momentum card's mirrored area chart: home
 * plotted on the positive y-axis, away on the negative.
 *
 * Live matches: the timeline still fills 0..80 samples so the x-axis
 * scale is stable, but callers should draw the paths only up to
 * `effectiveMinute` — everything after that is "not yet played".
 */
export function useMatchMomentumTimeline(
  fixtureId: string,
  homeTeamId: string,
  awayTeamId: string,
): {
  /** Signed net-momentum samples across the 80-minute canvas. Positive
   *  entries mean home has the initiative in the trailing window;
   *  negative means away does. */
  samples: readonly MomentumSample[];
  /** Symmetric y-axis extent (max absolute net across the window).
   *  Floored so a single try still reads as a meaningful swing. */
  maxAbs: number;
  /** Last minute for which we have data. Completed = 80. Live = the
   *  latest event minute (or 0 if none yet). Callers clip their curves
   *  to this value. */
  effectiveMinute: number;
  isLoading: boolean;
  hasData: boolean;
} {
  const fixture = useFixture(fixtureId);
  const events = useFixtureEvents(fixtureId, fixture.data?.status);

  return useMemo(() => {
    const status = fixture.data?.status;
    const isLive = status === 'live' || status === 'half-time';
    const isCompleted = status === 'completed';

    // Broader "attacking events" set — carries, line breaks, turnovers
    // won, try assists, and scoring events — anything that maps to a
    // non-zero weight in `EVENT_WEIGHTS`. Filtered once here so the
    // per-minute window scans stay cheap.
    const weightedEvents = (events.data ?? []).filter(
      (e): e is MatchEvent & { team_id: string } =>
        e.team_id !== null && EVENT_WEIGHTS[e.type] !== undefined,
    );

    const effectiveMinute = computeEffectiveMinute(events.data ?? [], isLive, isCompleted);

    // Compute net momentum per minute — a single signed signal. Momentum
    // is a zero-sum quantity: at any instant one side has the initiative
    // and the other doesn't, so we subtract rather than track two
    // independent series.
    const samples: MomentumSample[] = [];
    for (let m = 0; m <= TOTAL_MINUTES; m++) {
      const home = momentumInWindow(weightedEvents, homeTeamId, m);
      const away = momentumInWindow(weightedEvents, awayTeamId, m);
      samples.push({ minute: m, net: home - away });
    }

    const allAbs = samples.map((s) => Math.abs(s.net));
    // Floor of 10 keeps a single scoring event from filling the whole
    // canvas at the start of a match. 10 ~= one try's worth of net
    // swing, so peaks still read as "big moments" against the axis.
    const maxAbs = Math.max(10, ...allAbs);

    return {
      samples,
      maxAbs,
      effectiveMinute,
      isLoading: fixture.isLoading || events.isLoading,
      hasData: weightedEvents.length > 0 || isCompleted || isLive,
    };
  }, [fixture.data, fixture.isLoading, events.data, events.isLoading, homeTeamId, awayTeamId]);
}

/** Sum the weighted attacking events for `teamId` in the trailing window
 *  `(minute − W, minute]`. Returns 0 when the team has no attacking
 *  activity in the window — the natural "quiet stretch" behaviour. */
function momentumInWindow(
  events: readonly (MatchEvent & { team_id: string })[],
  teamId: string,
  minute: number,
): number {
  const windowStart = minute - WINDOW_MINUTES;
  let sum = 0;
  for (const e of events) {
    if (e.team_id !== teamId) continue;
    const weight = EVENT_WEIGHTS[e.type];
    if (weight === undefined) continue;
    const m = e.minute + e.stoppage;
    if (m > windowStart && m <= minute) sum += weight;
  }
  return sum;
}

function computeEffectiveMinute(
  events: readonly MatchEvent[],
  isLive: boolean,
  isCompleted: boolean,
): number {
  if (isCompleted) return TOTAL_MINUTES;
  if (!isLive) return 0;
  if (events.length === 0) return 0;
  const latest = events.reduce((m, e) => Math.max(m, e.minute + e.stoppage), 0);
  return Math.min(TOTAL_MINUTES, latest);
}

/** Exported for the info modal so the described window can stay in sync
 *  with the code without touching two strings. */
export function momentumWindowMinutes(): number {
  return WINDOW_MINUTES;
}

/** Exported so callers know the canvas width. */
export function momentumTotalMinutes(): number {
  return TOTAL_MINUTES;
}

/**
 * Fixture status → whether momentum has any story to tell.
 * Scheduled matches have no events yet, so the card renders an empty
 * state rather than a flat baseline.
 */
export function fixtureHasMomentum(fixtureStatus: Fixture['status'] | undefined): boolean {
  return (
    fixtureStatus === 'live' ||
    fixtureStatus === 'half-time' ||
    fixtureStatus === 'completed'
  );
}
