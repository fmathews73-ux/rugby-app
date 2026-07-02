/**
 * TanStack Query hooks — one per endpoint. Each hook is trivially thin so
 * the type on the return channel comes straight from `@rugby-app/shared`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type {
  Bracket,
  Competition,
  Fixture,
  LineUp,
  Player,
  RankingSnapshot,
  Result,
  Season,
  Squad,
  Standings,
  Team,
} from '@rugby-app/shared';

import { fetchJson } from './client';

interface HealthResponse {
  service: string;
  status: 'ok';
  entities: Record<string, number>;
}

export function useHealth(): UseQueryResult<HealthResponse> {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchJson<HealthResponse>('/'),
  });
}

export function useCompetitions(): UseQueryResult<Competition[]> {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: () => fetchJson<Competition[]>('/competitions'),
  });
}

export function useSeasons(competitionId?: string): UseQueryResult<Season[]> {
  return useQuery({
    queryKey: ['seasons', competitionId],
    queryFn: () =>
      fetchJson<Season[]>(
        competitionId ? `/seasons?competition_id=${competitionId}` : '/seasons',
      ),
  });
}

export function useSeason(seasonId: string): UseQueryResult<Season> {
  return useQuery({
    queryKey: ['season', seasonId],
    queryFn: () => fetchJson<Season>(`/seasons/${seasonId}`),
    enabled: Boolean(seasonId),
  });
}

export function useSeasonFixtures(seasonId: string): UseQueryResult<Fixture[]> {
  return useQuery({
    queryKey: ['seasonFixtures', seasonId],
    queryFn: () => fetchJson<Fixture[]>(`/seasons/${seasonId}/fixtures`),
    enabled: Boolean(seasonId),
  });
}

export function useSeasonStandings(seasonId: string): UseQueryResult<Standings[]> {
  return useQuery({
    queryKey: ['seasonStandings', seasonId],
    queryFn: () => fetchJson<Standings[]>(`/seasons/${seasonId}/standings`),
    enabled: Boolean(seasonId),
  });
}

export function useSeasonBracket(seasonId: string): UseQueryResult<Bracket> {
  return useQuery({
    queryKey: ['seasonBracket', seasonId],
    queryFn: () => fetchJson<Bracket>(`/seasons/${seasonId}/bracket`),
    enabled: Boolean(seasonId),
  });
}

export function useFixture(fixtureId: string): UseQueryResult<Fixture> {
  return useQuery({
    queryKey: ['fixture', fixtureId],
    queryFn: () => fetchJson<Fixture>(`/fixtures/${fixtureId}`),
    enabled: Boolean(fixtureId),
  });
}

export function useFixtureResult(fixtureId: string): UseQueryResult<Result> {
  return useQuery({
    queryKey: ['fixtureResult', fixtureId],
    queryFn: () => fetchJson<Result>(`/fixtures/${fixtureId}/result`),
    enabled: Boolean(fixtureId),
  });
}

export function useFixtureLineups(fixtureId: string): UseQueryResult<LineUp[]> {
  return useQuery({
    queryKey: ['fixtureLineups', fixtureId],
    queryFn: () => fetchJson<LineUp[]>(`/fixtures/${fixtureId}/lineups`),
    enabled: Boolean(fixtureId),
  });
}

export function useTeams(): UseQueryResult<Team[]> {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => fetchJson<Team[]>('/teams'),
  });
}

export function useTeam(teamId: string): UseQueryResult<Team & { fixtures: Fixture[] }> {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => fetchJson<Team & { fixtures: Fixture[] }>(`/teams/${teamId}`),
    enabled: Boolean(teamId),
  });
}

export function useTeamSquad(
  teamId: string,
  seasonId: string,
): UseQueryResult<{ squad: Squad; players: Player[] }> {
  return useQuery({
    queryKey: ['teamSquad', teamId, seasonId],
    queryFn: () =>
      fetchJson<{ squad: Squad; players: Player[] }>(
        `/teams/${teamId}/squad?season_id=${seasonId}`,
      ),
    enabled: Boolean(teamId && seasonId),
  });
}

export function usePlayer(playerId: string): UseQueryResult<Player> {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: () => fetchJson<Player>(`/players/${playerId}`),
    enabled: Boolean(playerId),
  });
}

/**
 * Latest men's ranking snapshot. Kept named without a `Mens` suffix so existing
 * call sites don't churn — the mens ranking is the "default" ranking screen
 * because it's what mainstream rugby coverage centres on. See
 * `useLatestWomensRanking` for the women's counterpart.
 */
export function useLatestRanking(): UseQueryResult<RankingSnapshot> {
  return useQuery({
    queryKey: ['ranking', 'mens', 'latest'],
    queryFn: () => fetchJson<RankingSnapshot>('/rankings/mens'),
  });
}

export function useLatestWomensRanking(): UseQueryResult<RankingSnapshot> {
  return useQuery({
    queryKey: ['ranking', 'womens', 'latest'],
    queryFn: () => fetchJson<RankingSnapshot>('/rankings/womens'),
  });
}

export function useRankingHistory(): UseQueryResult<RankingSnapshot[]> {
  return useQuery({
    queryKey: ['ranking', 'mens', 'history'],
    queryFn: () => fetchJson<RankingSnapshot[]>('/rankings/mens/history'),
  });
}

export function useWomensRankingHistory(): UseQueryResult<RankingSnapshot[]> {
  return useQuery({
    queryKey: ['ranking', 'womens', 'history'],
    queryFn: () => fetchJson<RankingSnapshot[]>('/rankings/womens/history'),
  });
}
