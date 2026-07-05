import { useMemo } from 'react';

import type { PlayerMatchStats } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { usePlayerMatchHistory } from '@/hooks/use-player-match-stats';

/**
 * Numeric stat fields aggregated across a player's appearance window.
 * Mirrors the PlayerMatchStats sheet minus identity / participation
 * fields (those are handled separately).
 */
const STAT_FIELDS = [
  'tries',
  'try_assists',
  'points',
  'carries',
  'metres_carried',
  'clean_breaks',
  'defenders_beaten',
  'offloads',
  'passes',
  'handling_errors',
  'conversions',
  'penalty_goals',
  'drop_goals',
  'kicks_from_hand',
  'kick_metres',
  'tackles_made',
  'missed_tackles',
  'turnovers_won',
  'rucks_hit',
  'lineout_takes',
  'lineout_steals',
  'penalties_conceded',
  'yellow_cards',
  'red_cards',
] as const;

export type PlayerStatField = (typeof STAT_FIELDS)[number];

export interface PlayerAggregate {
  playerId: string;
  /** Sheets in the window where the player actually took the field
   *  (minutes_played > 0). Unused-bench sheets don't count. */
  appearances: number;
  /** Of those appearances, how many were starts. */
  starts: number;
  minutesTotal: number;
  /** Raw sums across the window. */
  totals: Record<PlayerStatField, number>;
  /** Per-appearance averages (totals / appearances). The scan-friendly
   *  read for the player card's totals strip. */
  perGame: Record<PlayerStatField, number>;
  /** Per-80-minute rates (totals × 80 / minutesTotal). Fairer basis for
   *  percentile comparison — bench players aren't punished for shorter
   *  shifts. */
  per80: Record<PlayerStatField, number>;
}

interface UsePlayerAggregateResult {
  data: PlayerAggregate | undefined;
  isLoading: boolean;
}

/**
 * A player's aggregate over their most recent appearances — the player-
 * level mirror of `useTeamAggregate`. One data atom (per-match sheets)
 * serves both scopes: this hook windows the atoms for the trend read;
 * `usePlayerMatchStats` reads a single atom for the match read.
 *
 * @param asOfDate When set, only sheets from fixtures that KICKED OFF
 *   before this ISO timestamp count — freezes the window to the state
 *   walking into a specific match (same semantic as useTeamAggregate).
 * @param lookback When set, aggregate only the most recent N
 *   appearances (after the asOfDate filter). "prev. 10" by convention.
 */
export function usePlayerAggregate(
  playerId: string,
  asOfDate?: string,
  lookback?: number,
): UsePlayerAggregateResult {
  const history = usePlayerMatchHistory(playerId);

  // Sheets don't carry kickoff timestamps (canonical purity — they
  // reference fixture_id). Join kickoffs via the player's team fixture
  // list: internationals never switch national sides, so the team on
  // the most recent sheet covers every fixture in the history.
  const teamId = history.data?.[0]?.team_id ?? '';
  const team = useTeam(teamId);

  const kickoffByFixture = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of team.data?.fixtures ?? []) m.set(f.id, f.kickoff_utc);
    return m;
  }, [team.data]);

  const data = useMemo<PlayerAggregate | undefined>(() => {
    if (!history.data) return undefined;
    // History arrives kickoff-DESC from the server. Filter to actual
    // appearances, apply the asOfDate freeze, then take the window.
    let sheets = history.data.filter((s) => s.minutes_played > 0);
    if (asOfDate) {
      sheets = sheets.filter((s) => {
        const kickoff = kickoffByFixture.get(s.fixture_id);
        // Unknown kickoff (team fixtures not loaded yet) → exclude
        // rather than leak post-cutoff data into an "as of" snapshot.
        return kickoff !== undefined && kickoff < asOfDate;
      });
    }
    if (lookback !== undefined) sheets = sheets.slice(0, lookback);

    if (sheets.length === 0) {
      return {
        playerId,
        appearances: 0,
        starts: 0,
        minutesTotal: 0,
        totals: emptyStats(),
        perGame: emptyStats(),
        per80: emptyStats(),
      };
    }

    const totals = emptyStats();
    let minutesTotal = 0;
    let starts = 0;
    for (const s of sheets) {
      minutesTotal += s.minutes_played;
      if (s.started) starts++;
      for (const f of STAT_FIELDS) totals[f] += s[f];
    }

    const perGame = emptyStats();
    const per80 = emptyStats();
    for (const f of STAT_FIELDS) {
      perGame[f] = totals[f] / sheets.length;
      per80[f] = minutesTotal > 0 ? (totals[f] * 80) / minutesTotal : 0;
    }

    return {
      playerId,
      appearances: sheets.length,
      starts,
      minutesTotal,
      totals,
      perGame,
      per80,
    };
  }, [history.data, kickoffByFixture, playerId, asOfDate, lookback]);

  return {
    data,
    isLoading: history.isLoading || (Boolean(teamId) && team.isLoading),
  };
}

function emptyStats(): Record<PlayerStatField, number> {
  const out = {} as Record<PlayerStatField, number>;
  for (const f of STAT_FIELDS) out[f] = 0;
  return out;
}
