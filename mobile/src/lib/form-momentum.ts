/**
 * Shared "form momentum" primitives used by the Home My-Team card and the
 * Insights tab (Movers strip, Team grid, extended sparkline). Keeps the
 * point-differential + weighted-momentum + streak math in one place so the
 * numbers displayed across the app stay consistent.
 */

import type { Fixture, Result } from '@rugby-app/shared';

export type FormOutcome = 'W' | 'L' | 'D';
export interface FormPoint {
  diff: number;
  outcome: FormOutcome;
}

/** Weights used across all momentum calculations — most-recent-first. */
export const MOMENTUM_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2] as const;

/**
 * Given a team's completed fixtures (any order) and a map of results,
 * return the last N in oldest→newest order (for direct sparkline use).
 */
export function formPointsFor(
  teamId: string,
  completedFixtures: readonly Fixture[],
  resultByFixture: ReadonlyMap<string, Result>,
  lookback: number,
): FormPoint[] {
  const mostRecentFirst = [...completedFixtures]
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
    .slice(0, lookback);
  const out: FormPoint[] = [];
  for (const fx of [...mostRecentFirst].reverse()) {
    const r = resultByFixture.get(fx.id);
    if (!r) continue;
    const isHome = fx.home_team_id === teamId;
    const myScore = isHome ? r.home_score : r.away_score;
    const oppScore = isHome ? r.away_score : r.home_score;
    const diff = myScore - oppScore;
    const outcome: FormOutcome = diff > 0 ? 'W' : diff < 0 ? 'L' : 'D';
    out.push({ diff, outcome });
  }
  return out;
}

/**
 * Recency-weighted momentum score. Rounded to a whole number — the score is
 * a scannable indicator, not a precise statistic.
 */
export function momentumFor(
  teamId: string,
  completedFixtures: readonly Fixture[],
  resultByFixture: ReadonlyMap<string, Result>,
): number {
  const mostRecentFirst = [...completedFixtures]
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
    .slice(0, MOMENTUM_WEIGHTS.length);
  let sum = 0;
  mostRecentFirst.forEach((fx, i) => {
    const r = resultByFixture.get(fx.id);
    const w = MOMENTUM_WEIGHTS[i];
    if (!r || w === undefined) return;
    const isHome = fx.home_team_id === teamId;
    const myScore = isHome ? r.home_score : r.away_score;
    const oppScore = isHome ? r.away_score : r.home_score;
    sum += (myScore - oppScore) * w;
  });
  return Math.round(sum);
}

/**
 * Current streak — walk most-recent-first, count consecutive same-outcome
 * matches, break on the first differing result. Returns `null` when no
 * completed results have loaded yet.
 */
export function streakFor(
  teamId: string,
  completedFixtures: readonly Fixture[],
  resultByFixture: ReadonlyMap<string, Result>,
): { letter: FormOutcome; count: number } | null {
  const mostRecentFirst = [...completedFixtures].sort((a, b) =>
    b.kickoff_utc.localeCompare(a.kickoff_utc),
  );
  let letter: FormOutcome | null = null;
  let count = 0;
  for (const fx of mostRecentFirst) {
    const r = resultByFixture.get(fx.id);
    if (!r) break;
    const isHome = fx.home_team_id === teamId;
    const myScore = isHome ? r.home_score : r.away_score;
    const oppScore = isHome ? r.away_score : r.home_score;
    const l: FormOutcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';
    if (letter === null) {
      letter = l;
      count = 1;
    } else if (letter === l) {
      count += 1;
    } else {
      break;
    }
  }
  return letter ? { letter, count } : null;
}
