/**
 * TanStack Query hooks — one per endpoint. Each hook is trivially thin so
 * the type on the return channel comes straight from `@rugby-app/shared`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type {
  Bracket,
  Coach,
  Competition,
  Fixture,
  LineUp,
  Player,
  MatchEvent,
  MatchOfficial,
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

/** Chronological match-event timeline for a fixture. Returns an empty
 *  array (not an error) for fixtures that have no events yet — the
 *  Overview timeline UI can treat empty as "not yet available". */
export function useFixtureEvents(fixtureId: string): UseQueryResult<MatchEvent[]> {
  return useQuery({
    queryKey: ['fixtureEvents', fixtureId],
    queryFn: () => fetchJson<MatchEvent[]>(`/fixtures/${fixtureId}/events`),
    enabled: Boolean(fixtureId),
  });
}

/** Match officials for a fixture — referee, two assistant referees, TMO.
 *  Announced pre-match so scheduled fixtures already carry a full slate.
 *  Returns an empty array (not an error) if the assignment isn't recorded. */
export function useFixtureOfficials(fixtureId: string): UseQueryResult<MatchOfficial[]> {
  return useQuery({
    queryKey: ['fixtureOfficials', fixtureId],
    queryFn: () => fetchJson<MatchOfficial[]>(`/fixtures/${fixtureId}/officials`),
    enabled: Boolean(fixtureId),
  });
}

/** All players relevant to a fixture — union of both lineups (starting +
 *  bench) and every player_id / related_player_id in that fixture's
 *  events. Client builds a `playerById` map to look up names inside the
 *  Line-Up and Overview panes without per-player round trips. */
export function useFixturePlayers(fixtureId: string): UseQueryResult<Player[]> {
  return useQuery({
    queryKey: ['fixturePlayers', fixtureId],
    queryFn: () => fetchJson<Player[]>(`/fixtures/${fixtureId}/players`),
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

/** Coaching staff for a team. Returns an empty array when unavailable —
 *  the client can hide the section rather than error out. Real-feed
 *  coaching-staff availability is still a Phase 6 research item (register #7). */
export function useTeamCoachingStaff(teamId: string): UseQueryResult<Coach[]> {
  return useQuery({
    queryKey: ['teamCoachingStaff', teamId],
    queryFn: () => fetchJson<Coach[]>(`/teams/${teamId}/coaching-staff`),
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
