import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';
import type { FormOutcome } from '@/hooks/use-team-recent-form';

export interface TeamMatchPoint {
  fixtureId: string;
  kickoff: string;
  outcome: FormOutcome;
  /** Points margin from the team's perspective (positive = won by). */
  margin: number;
  possessionPercent: number;
  penaltiesConceded: number;
  turnoversWon: number;
  turnoversConceded: number;
}

interface UseTeamMatchSeriesResult {
  /** Chronological (oldest → newest) per-match points. */
  data: TeamMatchPoint[];
  isLoading: boolean;
}

/**
 * Per-match series over a team's most recent completed fixtures — the
 * match-by-match atoms behind the aggregate cards, oriented to the
 * team's perspective. Feeds the team Insights charts (Possession vs
 * Outcome scatter, Discipline Trend). Result fetches share the
 * TanStack cache with every other consumer.
 */
export function useTeamMatchSeries(
  teamId: string,
  lookback: number,
  /** When set, only fixtures that kicked off BEFORE this ISO timestamp
   *  count (same semantic as useTeamAggregate). */
  asOfDate?: string,
): UseTeamMatchSeriesResult {
  const team = useTeam(teamId);

  const recentFixtures: Fixture[] = useMemo(
    () =>
      (team.data?.fixtures ?? [])
        .filter((f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate))
        .slice()
        .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
        .slice(0, lookback),
    [team.data, lookback, asOfDate],
  );

  const resultQueries = useQueries({
    queries: recentFixtures.map((f) => ({
      queryKey: ['fixtureResult', f.id],
      queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
    })),
  });

  const isLoading = team.isLoading || resultQueries.some((q) => q.isLoading);

  const data = useMemo<TeamMatchPoint[]>(() => {
    const points: TeamMatchPoint[] = [];
    for (let i = 0; i < recentFixtures.length; i++) {
      const fx = recentFixtures[i]!;
      const r = resultQueries[i]?.data;
      if (!r) continue;
      const isHome = fx.home_team_id === teamId;
      const my = isHome ? r.home_score : r.away_score;
      const opp = isHome ? r.away_score : r.home_score;
      points.push({
        fixtureId: fx.id,
        kickoff: fx.kickoff_utc,
        outcome: my > opp ? 'W' : my < opp ? 'L' : 'D',
        margin: my - opp,
        possessionPercent: isHome ? r.home_possession_percent : r.away_possession_percent,
        penaltiesConceded: isHome ? r.home_penalties_conceded : r.away_penalties_conceded,
        turnoversWon: isHome ? r.home_turnovers_won : r.away_turnovers_won,
        turnoversConceded: isHome ? r.home_turnovers_conceded : r.away_turnovers_conceded,
      });
    }
    // Oldest → newest for left-to-right time on charts.
    return points.reverse();
  }, [recentFixtures, resultQueries, teamId]);

  return { data, isLoading };
}
