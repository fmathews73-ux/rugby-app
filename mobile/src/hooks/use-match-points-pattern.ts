/**
 * Per-match "points pattern" — how a team's points (or points conceded)
 * were distributed across the four 20-minute blocks of a single fixture.
 * The match-only counterpart to `useTeamPointsPattern` (which averages
 * across many completed fixtures).
 *
 * Returns the same shape as `useTeamPointsPattern` so the same rendering
 * component can consume either data source with no visual changes.
 * `gamesUsed` is 1 when the match has scoring events, 0 otherwise.
 */

import { useMemo } from 'react';

import type { MatchEvent } from '@rugby-app/shared';

import { useFixture, useFixtureEvents } from '@/api/hooks';
import type {
  PointsPatternMode,
  TeamPointsPattern,
} from '@/hooks/use-team-points-pattern';

interface Result {
  data: TeamPointsPattern | undefined;
  isLoading: boolean;
}

export function useMatchPointsPattern(
  fixtureId: string,
  teamId: string,
  mode: PointsPatternMode = 'scored',
): Result {
  const fixture = useFixture(fixtureId);
  const events = useFixtureEvents(fixtureId, fixture.data?.status);

  const data = useMemo<TeamPointsPattern | undefined>(() => {
    if (!fixture.data || !events.data) return undefined;

    const isRelevant = (e: MatchEvent): boolean => {
      if (e.points <= 0 || !e.team_id) return false;
      if (mode === 'scored') return e.team_id === teamId;
      // 'conceded' — points scored by the OTHER team in this fixture.
      return (
        e.team_id !== teamId &&
        (e.team_id === fixture.data!.home_team_id ||
          e.team_id === fixture.data!.away_team_id)
      );
    };

    const quarters: [number, number, number, number] = [0, 0, 0, 0];
    for (const e of events.data) {
      if (!isRelevant(e)) continue;
      const min = e.minute + (e.stoppage ?? 0);
      const q = min < 20 ? 0 : min < 40 ? 1 : min < 60 ? 2 : 3;
      quarters[q] += e.points;
    }

    const total = quarters[0] + quarters[1] + quarters[2] + quarters[3];
    if (total === 0) {
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
      gamesUsed: 1,
      avgPercentByQuarter: [
        (quarters[0]! / total) * 100,
        (quarters[1]! / total) * 100,
        (quarters[2]! / total) * 100,
        (quarters[3]! / total) * 100,
      ],
      avgPointsByQuarter: [quarters[0]!, quarters[1]!, quarters[2]!, quarters[3]!],
    };
  }, [events.data, fixture.data, teamId, mode]);

  return { data, isLoading: events.isLoading || fixture.isLoading };
}
