import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';

export type FormOutcome = 'W' | 'L' | 'D';

interface UseTeamRecentFormResult {
  /** Outcomes from newest → oldest. Length ≤ `lookback`; may be empty if
   *  the team hasn't played any completed fixtures yet. */
  outcomes: FormOutcome[];
  isLoading: boolean;
}

/**
 * A team's most-recent `lookback` completed fixture outcomes (W/L/D) from
 * that team's perspective. Powers the little `W L W W L` circle strip in
 * the Team Selector card and the Team Picker modal.
 *
 * Reuses the same fixture-list + per-result-fetch pattern as
 * `useTeamAggregate`; TanStack Query dedupes so the result queries here
 * share cache with other consumers.
 */
export function useTeamRecentForm(
  teamId: string,
  lookback: number,
  /** When set, only fixtures that kicked off BEFORE this ISO timestamp
   *  count — freezes the form window to the state walking into a
   *  specific match (same semantic as useTeamAggregate). */
  asOfDate?: string,
): UseTeamRecentFormResult {
  const team = useTeam(teamId);

  const recentFixtures: Fixture[] = useMemo(() => {
    return (team.data?.fixtures ?? [])
      .filter((f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate))
      .slice()
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, lookback);
  }, [team.data, lookback, asOfDate]);

  const resultQueries = useQueries({
    queries: recentFixtures.map((f) => ({
      queryKey: ['fixtureResult', f.id],
      queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
    })),
  });

  const isLoading = team.isLoading || resultQueries.some((q) => q.isLoading);

  const outcomes = useMemo<FormOutcome[]>(() => {
    const out: FormOutcome[] = [];
    for (let i = 0; i < recentFixtures.length; i++) {
      const fx = recentFixtures[i]!;
      const r = resultQueries[i]?.data;
      if (!r) continue;
      const isHome = fx.home_team_id === teamId;
      const myScore = isHome ? r.home_score : r.away_score;
      const oppScore = isHome ? r.away_score : r.home_score;
      out.push(myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D');
    }
    return out;
  }, [recentFixtures, resultQueries, teamId]);

  return { outcomes, isLoading };
}
