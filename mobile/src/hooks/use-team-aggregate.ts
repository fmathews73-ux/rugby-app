/**
 * Per-team aggregate stats derived from Results across a team's completed
 * fixtures. Feeds the Insights → Team Radar + Efficiency KPI strip. Pure
 * client-side aggregation over cached endpoints — no new API surface.
 *
 * All averages are per-game. The raw shape is deliberately un-normalised;
 * the Radar component chooses its own normalisation constants (fixed
 * thresholds vs pool-relative, etc.) so this hook can be reused for other
 * consumers (KPI strip, comparisons) without baking in a visualisation
 * choice.
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';

export interface TeamAggregate {
  teamId: string;
  gamesPlayed: number;
  perGame: {
    pointsScored: number;
    pointsConceded: number;
    tries: number;
    triesConceded: number;
    possessionPercent: number;
    territoryPercent: number;
    metersMade: number;
    lineBreaks: number;
    kicksInPlay: number;
    kickMeters: number;
    scrumSuccessPercent: number;
    lineoutSuccessPercent: number;
    tackleSuccessPercent: number;
    turnoversWon: number;
    turnoversConceded: number;
    penaltiesConceded: number;
    handlingErrors: number;
    yellowCards: number;
    redCards: number;
  };
}

interface UseTeamAggregateResult {
  data: TeamAggregate | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useTeamAggregate(
  teamId: string,
  /** When set, drop every fixture with kickoff at or after this ISO
   *  timestamp — used by the fixture-drill Preview cards to render the
   *  season-to-date snapshot AS OF THAT MATCH rather than as of today. */
  asOfDate?: string,
  /** When set, aggregate only over the most-recent `lookback` completed
   *  fixtures (after any `asOfDate` filter). Useful for "team's last N
   *  games" surfaces like the Home-page Profile radar. */
  lookback?: number,
): UseTeamAggregateResult {
  const team = useTeam(teamId);

  const completedFixtures: Fixture[] = useMemo(() => {
    const all = (team.data?.fixtures ?? []).filter(
      (f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate),
    );
    if (lookback === undefined) return all;
    // Sort newest-first, take N, then return. Order after this doesn't
    // matter to the aggregator, which just sums metrics across the set.
    return all
      .slice()
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, lookback);
  }, [team.data, asOfDate, lookback]);

  const resultQueries = useQueries({
    queries: completedFixtures.map((f) => ({
      queryKey: ['fixtureResult', f.id],
      queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
    })),
  });

  const isLoading = team.isLoading || resultQueries.some((q) => q.isLoading);
  const isError = team.isError || resultQueries.some((q) => q.isError);

  const data = useMemo<TeamAggregate | undefined>(() => {
    if (!team.data) return undefined;
    const results = resultQueries
      .map((q, i) => ({ result: q.data, fixture: completedFixtures[i] }))
      .filter(
        (r): r is { result: Result; fixture: Fixture } =>
          r.result !== undefined && r.fixture !== undefined,
      );
    if (results.length === 0) {
      return {
        teamId,
        gamesPlayed: 0,
        perGame: EMPTY_PER_GAME,
      };
    }

    // Sum every metric across all completed fixtures, orienting each field
    // to the target team's perspective (home vs away in the raw Result).
    let ptsFor = 0, ptsAgainst = 0, triesFor = 0, triesAgainst = 0;
    let poss = 0, terr = 0, meters = 0, lineBreaks = 0;
    let kicksInPlay = 0, kickMeters = 0;
    let scrumWon = 0, scrumLost = 0, lineoutWon = 0, lineoutLost = 0;
    let tackleSuccess = 0;
    let turnoversWon = 0, turnoversConceded = 0;
    let pensConceded = 0, handlingErrors = 0, yellows = 0, reds = 0;

    for (const { result, fixture } of results) {
      const isHome = fixture.home_team_id === teamId;
      ptsFor += isHome ? result.home_score : result.away_score;
      ptsAgainst += isHome ? result.away_score : result.home_score;
      triesFor += isHome ? result.home_tries : result.away_tries;
      triesAgainst += isHome ? result.away_tries : result.home_tries;
      poss += isHome ? result.home_possession_percent : result.away_possession_percent;
      terr += isHome ? result.home_territory_percent : result.away_territory_percent;
      meters += isHome ? result.home_meters : result.away_meters;
      lineBreaks += isHome ? result.home_line_breaks : result.away_line_breaks;
      kicksInPlay += isHome ? result.home_kicks_in_play : result.away_kicks_in_play;
      kickMeters += isHome ? result.home_kick_meters : result.away_kick_meters;
      scrumWon += isHome ? result.home_scrums_won : result.away_scrums_won;
      scrumLost += isHome ? result.home_scrums_lost : result.away_scrums_lost;
      lineoutWon += isHome ? result.home_lineouts_won : result.away_lineouts_won;
      lineoutLost += isHome ? result.home_lineouts_lost : result.away_lineouts_lost;
      tackleSuccess += isHome
        ? result.home_tackle_success_percent
        : result.away_tackle_success_percent;
      turnoversWon += isHome ? result.home_turnovers_won : result.away_turnovers_won;
      turnoversConceded += isHome
        ? result.home_turnovers_conceded
        : result.away_turnovers_conceded;
      pensConceded += isHome
        ? result.home_penalties_conceded
        : result.away_penalties_conceded;
      handlingErrors += isHome ? result.home_handling_errors : result.away_handling_errors;
      yellows += isHome ? result.home_yellow_cards : result.away_yellow_cards;
      reds += isHome ? result.home_red_cards : result.away_red_cards;
    }

    const n = results.length;
    const scrumTotal = scrumWon + scrumLost;
    const lineoutTotal = lineoutWon + lineoutLost;

    return {
      teamId,
      gamesPlayed: n,
      perGame: {
        pointsScored: ptsFor / n,
        pointsConceded: ptsAgainst / n,
        tries: triesFor / n,
        triesConceded: triesAgainst / n,
        possessionPercent: poss / n,
        territoryPercent: terr / n,
        metersMade: meters / n,
        lineBreaks: lineBreaks / n,
        kicksInPlay: kicksInPlay / n,
        kickMeters: kickMeters / n,
        scrumSuccessPercent: scrumTotal > 0 ? (scrumWon / scrumTotal) * 100 : 0,
        lineoutSuccessPercent: lineoutTotal > 0 ? (lineoutWon / lineoutTotal) * 100 : 0,
        tackleSuccessPercent: tackleSuccess / n,
        turnoversWon: turnoversWon / n,
        turnoversConceded: turnoversConceded / n,
        penaltiesConceded: pensConceded / n,
        handlingErrors: handlingErrors / n,
        yellowCards: yellows / n,
        redCards: reds / n,
      },
    };
  }, [team.data, resultQueries, completedFixtures, teamId]);

  return { data, isLoading, isError };
}

const EMPTY_PER_GAME: TeamAggregate['perGame'] = {
  pointsScored: 0,
  pointsConceded: 0,
  tries: 0,
  triesConceded: 0,
  possessionPercent: 0,
  territoryPercent: 0,
  metersMade: 0,
  lineBreaks: 0,
  kicksInPlay: 0,
  kickMeters: 0,
  scrumSuccessPercent: 0,
  lineoutSuccessPercent: 0,
  tackleSuccessPercent: 0,
  turnoversWon: 0,
  turnoversConceded: 0,
  penaltiesConceded: 0,
  handlingErrors: 0,
  yellowCards: 0,
  redCards: 0,
};

/**
 * Aggregate averages across a set of teams — used to compute the T1
 * reference outline on the Radar. Simple arithmetic mean over each metric.
 */
export function averageAggregates(aggregates: readonly TeamAggregate[]): TeamAggregate['perGame'] {
  if (aggregates.length === 0) return EMPTY_PER_GAME;
  const keys = Object.keys(EMPTY_PER_GAME) as (keyof TeamAggregate['perGame'])[];
  const out = { ...EMPTY_PER_GAME };
  for (const k of keys) {
    let sum = 0;
    for (const a of aggregates) sum += a.perGame[k];
    out[k] = sum / aggregates.length;
  }
  return out;
}
