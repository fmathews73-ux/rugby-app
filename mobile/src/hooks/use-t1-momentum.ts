/**
 * Bulk-fetches momentum + streak + sparkline points for every Tier-1 team.
 * Consumed by the Insights Movers strip and Team grid — one query fan-out,
 * shared cache. Individual team detail pages continue to consume the same
 * `useTeam` + `fixtureResult` endpoints so cache entries overlap.
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result, Team } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import {
  formPointsFor,
  momentumFor,
  streakFor,
  type FormPoint,
  type FormOutcome,
} from '@/lib/form-momentum';

/** Canonical Tier-1 international men's teams (PRD §3.4). */
export const TIER_1_TEAM_IDS = [
  'nzl', 'rsa', 'ire', 'fra', 'sco', 'eng', 'arg', 'aus', 'ita', 'wal',
] as const;
export type Tier1TeamId = (typeof TIER_1_TEAM_IDS)[number];

export interface TeamMomentumSummary {
  teamId: string;
  team: Team & { fixtures: Fixture[] } | undefined;
  momentum: number;
  streak: { letter: FormOutcome; count: number } | null;
  points: FormPoint[];
}

export function useT1Momentum(lookback = 5): {
  data: TeamMomentumSummary[];
  isLoading: boolean;
} {
  const teamQueries = useQueries({
    queries: TIER_1_TEAM_IDS.map((id) => ({
      queryKey: ['team', id],
      queryFn: () => fetchJson<Team & { fixtures: Fixture[] }>(`/teams/${id}`),
    })),
  });

  const completedFixtures = useMemo(() => {
    const byTeam = new Map<string, Fixture[]>();
    teamQueries.forEach((q, i) => {
      const id = TIER_1_TEAM_IDS[i];
      if (!id || !q.data) return;
      byTeam.set(
        id,
        q.data.fixtures.filter((f) => f.status === 'completed'),
      );
    });
    return byTeam;
  }, [teamQueries]);

  // De-duplicated set of fixture ids we need results for — many T1-vs-T1
  // fixtures appear in both teams' rosters, so this saves half the queries.
  const fixtureIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fixtures of completedFixtures.values()) {
      for (const f of fixtures) ids.add(f.id);
    }
    return [...ids];
  }, [completedFixtures]);

  const resultQueries = useQueries({
    queries: fixtureIds.map((id) => ({
      queryKey: ['fixtureResult', id],
      queryFn: () => fetchJson<Result>(`/fixtures/${id}/result`),
    })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) if (q.data) m.set(q.data.fixture_id, q.data);
    return m;
  }, [resultQueries]);

  const data = useMemo<TeamMomentumSummary[]>(() => {
    return TIER_1_TEAM_IDS.map((id, i) => {
      const teamData = teamQueries[i]?.data;
      const fixtures = completedFixtures.get(id) ?? [];
      return {
        teamId: id,
        team: teamData,
        momentum: momentumFor(id, fixtures, resultByFixture),
        streak: streakFor(id, fixtures, resultByFixture),
        points: formPointsFor(id, fixtures, resultByFixture, lookback),
      };
    });
  }, [teamQueries, completedFixtures, resultByFixture, lookback]);

  const isLoading =
    teamQueries.some((q) => q.isLoading) || resultQueries.some((q) => q.isLoading);

  return { data, isLoading };
}
