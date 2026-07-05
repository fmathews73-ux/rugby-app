/**
 * Per-team "points pattern" — the average share of a team's points by
 * quarter across their completed fixtures. Two modes:
 *
 *   'scored'   — points the team scored themselves (attacking pattern)
 *   'conceded' — points the opponent scored against the team (defensive
 *                pattern — when does this team leak points?)
 *
 * Powers the Insights → Scoring Pattern + Concession Pattern cards.
 * Rugby doesn't have formal quarters, but coaches / analysts widely use
 * 20-min blocks (Q1 0–20, Q2 20–40, Q3 40–60, Q4 60+) to spot patterns.
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, MatchEvent } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';

export type PointsPatternMode = 'scored' | 'conceded';

export interface TeamPointsPattern {
  teamId: string;
  mode: PointsPatternMode;
  /** Number of completed fixtures with at least one relevant scoring event
   *  — the sample size behind the averages. */
  gamesUsed: number;
  /** Average % of the relevant points per quarter, averaged across
   *  `gamesUsed` matches. Sums to ~100 (rounding aside). */
  avgPercentByQuarter: [number, number, number, number];
  /** Average absolute points per quarter, across `gamesUsed` matches. */
  avgPointsByQuarter: [number, number, number, number];
}

interface Result {
  data: TeamPointsPattern | undefined;
  isLoading: boolean;
}

export function useTeamPointsPattern(
  teamId: string,
  mode: PointsPatternMode = 'scored',
  /** When set, only fixtures that kicked off BEFORE this ISO timestamp
   *  count — freezes the pattern to the state walking into a specific
   *  match (same semantic as useTeamAggregate). */
  asOfDate?: string,
): Result {
  const team = useTeam(teamId);

  const completedFixtures: Fixture[] = useMemo(
    () =>
      (team.data?.fixtures ?? []).filter(
        (f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate),
      ),
    [team.data, asOfDate],
  );

  const eventQueries = useQueries({
    queries: completedFixtures.map((f) => ({
      queryKey: ['fixtureEvents', f.id],
      queryFn: () => fetchJson<MatchEvent[]>(`/fixtures/${f.id}/events`),
    })),
  });

  const isLoading = team.isLoading || eventQueries.some((q) => q.isLoading);

  const data = useMemo<TeamPointsPattern | undefined>(() => {
    if (!team.data) return undefined;

    // Averaging PERCENTAGES (not absolute points) gives every match equal
    // weight regardless of scoreline size — a 3-point margin match counts
    // the same as a 40-point margin match, which matches how coaches read
    // "scoring pattern".
    const percentSum: [number, number, number, number] = [0, 0, 0, 0];
    const pointsSum: [number, number, number, number] = [0, 0, 0, 0];
    let gamesUsed = 0;

    completedFixtures.forEach((fixture, i) => {
      const events = eventQueries[i]?.data;
      if (!events) return;

      // In 'scored' mode, count events by THIS team. In 'conceded' mode,
      // count events by anyone else on the fixture (i.e. the opponent).
      const isRelevant = (e: MatchEvent): boolean => {
        if (e.points <= 0 || !e.team_id) return false;
        return mode === 'scored'
          ? e.team_id === teamId
          : e.team_id !== teamId &&
              (e.team_id === fixture.home_team_id || e.team_id === fixture.away_team_id);
      };

      const quarters: [number, number, number, number] = [0, 0, 0, 0];
      for (const e of events) {
        if (!isRelevant(e)) continue;
        const min = e.minute + (e.stoppage ?? 0);
        const q = min < 20 ? 0 : min < 40 ? 1 : min < 60 ? 2 : 3;
        quarters[q] += e.points;
      }
      const total = quarters[0] + quarters[1] + quarters[2] + quarters[3];
      if (total === 0) return;

      for (let q = 0; q < 4; q++) {
        percentSum[q]! += (quarters[q]! / total) * 100;
        pointsSum[q]! += quarters[q]!;
      }
      gamesUsed += 1;
    });

    if (gamesUsed === 0) {
      return {
        teamId,
        mode,
        gamesUsed: 0,
        avgPercentByQuarter: [0, 0, 0, 0],
        avgPointsByQuarter: [0, 0, 0, 0],
      };
    }

    return {
      teamId,
      mode,
      gamesUsed,
      avgPercentByQuarter: [
        percentSum[0]! / gamesUsed,
        percentSum[1]! / gamesUsed,
        percentSum[2]! / gamesUsed,
        percentSum[3]! / gamesUsed,
      ],
      avgPointsByQuarter: [
        pointsSum[0]! / gamesUsed,
        pointsSum[1]! / gamesUsed,
        pointsSum[2]! / gamesUsed,
        pointsSum[3]! / gamesUsed,
      ],
    };
  }, [team.data, completedFixtures, eventQueries, teamId, mode]);

  return { data, isLoading };
}
