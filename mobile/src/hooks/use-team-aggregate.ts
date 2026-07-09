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
    twentyTwoEntries: number;
    pointsPerTwentyTwoEntry: number;
    lineBreaksConceded: number;
    scrumPenaltiesConceded: number;
    breakdownPenaltiesConceded: number;
    firstHalfPointsScored: number;
    secondHalfPointsScored: number;
    goalKickingPercent: number;
    firstHalfPointsConceded: number;
    secondHalfPointsConceded: number;
    conversions: number;
    penaltyGoals: number;
    dropGoals: number;
    postContactMetres: number;
    defendersBeaten: number;
    gainlineSuccessPercent: number;
    carries: number;
    passes: number;
    offloads: number;
    kicksToTouch: number;
    fiftyTwentyTwos: number;
    contestableKicks: number;
    contestableKicksWon: number;
    receptionsSecured: number;
    rucksWon: number;
    rucksLost: number;
    ruckSpeed0to3sPercent: number;
    maulsWon: number;
    maulsLost: number;
    tacklesMade: number;
    dominantTackles: number;
    scrumsWon: number;
    scrumsLost: number;
    lineoutsWon: number;
    lineoutsLost: number;
    offsidePenaltiesConceded: number;
    /** Contestable kicks put up per game. */
    contestablesDelivered: number;
    /** % of the team's own contestable kicks it regathered. */
    deliveredWonPercent: number;
    /** Opposition contestable kicks received per game. */
    contestablesReceived: number;
    /** % of received contestable kicks the team secured. */
    receivedWonPercent: number;
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
    let firstHalfFor = 0, secondHalfFor = 0;
    let lineBreaksConceded = 0;
    let scrumPens = 0, breakdownPens = 0;
    let poss = 0, terr = 0, meters = 0, lineBreaks = 0;
    let kicksInPlay = 0, kickMeters = 0;
    let scrumWon = 0, scrumLost = 0, lineoutWon = 0, lineoutLost = 0;
    let tackleSuccess = 0;
    let turnoversWon = 0, turnoversConceded = 0;
    let pensConceded = 0, handlingErrors = 0, yellows = 0, reds = 0;
    let entries22 = 0, pointsFrom22 = 0, goalKicksMade = 0, goalKicksAttempted = 0;
    let aerialDelivered = 0, aerialDeliveredWon = 0, aerialReceived = 0, aerialReceivedWon = 0;
    // Full-parity extension (owner call 2026-07-09) — the team Stats
    // pane mirrors the fixture Stats row set, so every fixture-pane
    // metric gets a per-game twin. Mirrors routes.ts form-summary.
    let firstHalfAgainst = 0, secondHalfAgainst = 0;
    let convs = 0, penGoals = 0, drops = 0;
    let postContact = 0, defBeaten = 0, gainlinePct = 0;
    let carriesN = 0, passesN = 0, offloadsN = 0;
    let kicksTouch = 0, fifty22s = 0;
    let rucksW = 0, rucksL = 0, quickBallPct = 0, maulsW = 0, maulsL = 0;
    let tacklesM = 0, domTackles = 0, offsidePens = 0;

    for (const { result, fixture } of results) {
      const isHome = fixture.home_team_id === teamId;
      ptsFor += isHome ? result.home_score : result.away_score;
      {
        const ht = isHome ? result.half_time_home : result.half_time_away;
        const ft = isHome ? result.home_score : result.away_score;
        firstHalfFor += ht;
        secondHalfFor += ft - ht;
        const htA = isHome ? result.half_time_away : result.half_time_home;
        const ftA = isHome ? result.away_score : result.home_score;
        firstHalfAgainst += htA;
        secondHalfAgainst += ftA - htA;
      }
      convs += isHome ? result.home_conversions : result.away_conversions;
      penGoals += isHome ? result.home_penalties : result.away_penalties;
      drops += isHome ? result.home_drop_goals : result.away_drop_goals;
      postContact += isHome ? result.home_post_contact_metres : result.away_post_contact_metres;
      defBeaten += isHome ? result.home_defenders_beaten : result.away_defenders_beaten;
      gainlinePct += isHome
        ? result.home_gainline_success_percent
        : result.away_gainline_success_percent;
      carriesN += isHome ? result.home_carries : result.away_carries;
      passesN += isHome ? result.home_passes : result.away_passes;
      offloadsN += isHome ? result.home_offloads : result.away_offloads;
      kicksTouch += isHome ? result.home_kicks_to_touch : result.away_kicks_to_touch;
      fifty22s += isHome ? result.home_fifty_twenty_twos : result.away_fifty_twenty_twos;
      rucksW += isHome ? result.home_rucks_won : result.away_rucks_won;
      rucksL += isHome ? result.home_rucks_lost : result.away_rucks_lost;
      quickBallPct += isHome
        ? result.home_ruck_speed_0_3s_percent
        : result.away_ruck_speed_0_3s_percent;
      maulsW += isHome ? result.home_mauls_won : result.away_mauls_won;
      maulsL += isHome ? result.home_mauls_lost : result.away_mauls_lost;
      tacklesM += isHome ? result.home_tackles_made : result.away_tackles_made;
      domTackles += isHome ? result.home_dominant_tackles : result.away_dominant_tackles;
      offsidePens += isHome
        ? result.home_offside_penalties_conceded
        : result.away_offside_penalties_conceded;
      ptsAgainst += isHome ? result.away_score : result.home_score;
      triesFor += isHome ? result.home_tries : result.away_tries;
      triesAgainst += isHome ? result.away_tries : result.home_tries;
      poss += isHome ? result.home_possession_percent : result.away_possession_percent;
      terr += isHome ? result.home_territory_percent : result.away_territory_percent;
      meters += isHome ? result.home_meters : result.away_meters;
      lineBreaks += isHome ? result.home_line_breaks : result.away_line_breaks;
      lineBreaksConceded += isHome ? result.away_line_breaks : result.home_line_breaks;
      scrumPens += isHome ? result.home_scrum_penalties_conceded : result.away_scrum_penalties_conceded;
      breakdownPens += isHome
        ? result.home_breakdown_penalties_conceded
        : result.away_breakdown_penalties_conceded;
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
      entries22 += isHome
        ? result.home_twenty_two_entries
        : result.away_twenty_two_entries;
      pointsFrom22 += isHome
        ? result.home_points_from_twenty_two_entries
        : result.away_points_from_twenty_two_entries;
      goalKicksMade += isHome
        ? result.home_conversions + result.home_penalties
        : result.away_conversions + result.away_penalties;
      goalKicksAttempted += isHome
        ? result.home_conversion_attempts + result.home_penalty_goal_attempts
        : result.away_conversion_attempts + result.away_penalty_goal_attempts;
      // Aerial contest — receptions derive from the OPPONENT's delivered
      // contestables (a kick one side puts up, the other receives).
      aerialDelivered += isHome ? result.home_contestable_kicks : result.away_contestable_kicks;
      aerialDeliveredWon += isHome
        ? result.home_contestable_kicks_won
        : result.away_contestable_kicks_won;
      aerialReceived += isHome ? result.away_contestable_kicks : result.home_contestable_kicks;
      aerialReceivedWon += isHome
        ? result.away_contestable_kicks - result.away_contestable_kicks_won
        : result.home_contestable_kicks - result.home_contestable_kicks_won;
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
        twentyTwoEntries: entries22 / n,
        // Ratio-of-sums so light-entry games don't overweigh.
        pointsPerTwentyTwoEntry: entries22 > 0 ? pointsFrom22 / entries22 : 0,
        lineBreaksConceded: lineBreaksConceded / n,
        scrumPenaltiesConceded: scrumPens / n,
        breakdownPenaltiesConceded: breakdownPens / n,
        firstHalfPointsScored: firstHalfFor / n,
        secondHalfPointsScored: secondHalfFor / n,
        goalKickingPercent:
          goalKicksAttempted > 0 ? (goalKicksMade / goalKicksAttempted) * 100 : 0,
        firstHalfPointsConceded: firstHalfAgainst / n,
        secondHalfPointsConceded: secondHalfAgainst / n,
        conversions: convs / n,
        penaltyGoals: penGoals / n,
        dropGoals: drops / n,
        postContactMetres: postContact / n,
        defendersBeaten: defBeaten / n,
        gainlineSuccessPercent: gainlinePct / n,
        carries: carriesN / n,
        passes: passesN / n,
        offloads: offloadsN / n,
        kicksToTouch: kicksTouch / n,
        fiftyTwentyTwos: fifty22s / n,
        contestableKicks: aerialDelivered / n,
        contestableKicksWon: aerialDeliveredWon / n,
        receptionsSecured: aerialReceivedWon / n,
        rucksWon: rucksW / n,
        rucksLost: rucksL / n,
        ruckSpeed0to3sPercent: quickBallPct / n,
        maulsWon: maulsW / n,
        maulsLost: maulsL / n,
        tacklesMade: tacklesM / n,
        dominantTackles: domTackles / n,
        scrumsWon: scrumWon / n,
        scrumsLost: scrumLost / n,
        lineoutsWon: lineoutWon / n,
        lineoutsLost: lineoutLost / n,
        offsidePenaltiesConceded: offsidePens / n,
        contestablesDelivered: aerialDelivered / n,
        // Ratio-of-sums so low-volume games don't overweigh.
        deliveredWonPercent:
          aerialDelivered > 0 ? (aerialDeliveredWon / aerialDelivered) * 100 : 0,
        contestablesReceived: aerialReceived / n,
        receivedWonPercent:
          aerialReceived > 0 ? (aerialReceivedWon / aerialReceived) * 100 : 0,
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
  twentyTwoEntries: 0,
  pointsPerTwentyTwoEntry: 0,
  lineBreaksConceded: 0,
  scrumPenaltiesConceded: 0,
  breakdownPenaltiesConceded: 0,
  firstHalfPointsScored: 0,
  secondHalfPointsScored: 0,
  goalKickingPercent: 0,
  firstHalfPointsConceded: 0,
  secondHalfPointsConceded: 0,
  conversions: 0,
  penaltyGoals: 0,
  dropGoals: 0,
  postContactMetres: 0,
  defendersBeaten: 0,
  gainlineSuccessPercent: 0,
  carries: 0,
  passes: 0,
  offloads: 0,
  kicksToTouch: 0,
  fiftyTwentyTwos: 0,
  contestableKicks: 0,
  contestableKicksWon: 0,
  receptionsSecured: 0,
  rucksWon: 0,
  rucksLost: 0,
  ruckSpeed0to3sPercent: 0,
  maulsWon: 0,
  maulsLost: 0,
  tacklesMade: 0,
  dominantTackles: 0,
  scrumsWon: 0,
  scrumsLost: 0,
  lineoutsWon: 0,
  lineoutsLost: 0,
  offsidePenaltiesConceded: 0,
  contestablesDelivered: 0,
  deliveredWonPercent: 0,
  contestablesReceived: 0,
  receivedWonPercent: 0,
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
