import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { PlayerMatchStats } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';

/**
 * All player stat sheets for one fixture. Fetched as a single list and
 * cached per fixture — the Line-Up pane's player tap-through reads
 * several players from the same match, so one query serves them all.
 */
export function useFixturePlayerStats(
  fixtureId: string,
): UseQueryResult<PlayerMatchStats[]> {
  return useQuery({
    queryKey: ['fixturePlayerStats', fixtureId],
    queryFn: () => fetchJson<PlayerMatchStats[]>(`/fixtures/${fixtureId}/player-stats`),
    enabled: Boolean(fixtureId),
  });
}

/**
 * One player's sheet within one fixture. Thin `select` over the
 * fixture-scoped query above so tapping through a Line-Up shares a
 * single cache entry per match.
 */
export function usePlayerMatchStats(
  fixtureId: string,
  playerId: string,
): UseQueryResult<PlayerMatchStats | undefined> {
  return useQuery({
    queryKey: ['fixturePlayerStats', fixtureId],
    queryFn: () => fetchJson<PlayerMatchStats[]>(`/fixtures/${fixtureId}/player-stats`),
    enabled: Boolean(fixtureId) && Boolean(playerId),
    select: (sheets) => sheets.find((s) => s.player_id === playerId),
  });
}

/**
 * Every stat sheet a player has across completed fixtures, sorted by
 * fixture kickoff DESCENDING (newest first — the server joins fixtures
 * to sort). Feeds `usePlayerAggregate`'s windowing and the per-
 * appearance trend sparklines on the player card.
 */
export function usePlayerMatchHistory(
  playerId: string,
): UseQueryResult<PlayerMatchStats[]> {
  return useQuery({
    queryKey: ['playerMatchStats', playerId],
    queryFn: () => fetchJson<PlayerMatchStats[]>(`/players/${playerId}/match-stats`),
    enabled: Boolean(playerId),
  });
}
