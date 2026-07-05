import { useMemo } from 'react';

import { useLatestRanking, useRankingHistory, useTeams } from '@/api/hooks';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamPointsPattern, type TeamPointsPattern } from '@/hooks/use-team-points-pattern';
import { useTeamRecentForm, type FormOutcome } from '@/hooks/use-team-recent-form';

/**
 * TODO(phase-6): client-side TEMPLATE implementation of the team-analysis
 * narrative, replaced at Phase 6 by server-side LLM inference whose
 * system prompt is `docs/analysis-narrative-spec.md` ("Team analysis"
 * section). Keep structure, tone, and thresholds in lockstep with that
 * doc, same as `useMatchAnalysis` and `usePlayerAnalysis`.
 */

// Completed-fixture window for all team reads.
const WINDOW = 10;
// Average margin that reads as dominance / struggle.
const MARGIN_STRONG = 7;
// Set-piece success bands.
const SET_PIECE_SOLID = 90;
const SET_PIECE_CONCERN = 85;
// Discipline bands (penalties conceded per game).
const PENS_HIGH = 12;
const PENS_LOW = 9;
// Ranking places over the snapshot span that count as a real move.
const RANK_MOVE = 2;
// Streak length worth naming.
const STREAK_MIN = 3;
// Quarter share (%) that reads as a real scoring-timing skew.
const TIMING_SKEW = 35;
// Recent-window vs season-baseline divergence worth reporting.
const BASELINE_DELTA = 0.15;

export interface TeamAnalysis {
  /** Unlabeled cold-open, mirrors the match / player cards. */
  summary: string;
  /** Recent results read: record, streak, margin. */
  form: string;
  /** World-ranking trajectory over the snapshot span. */
  ranking: string;
  /** Per-game season profile: attack, defence, set piece, discipline. */
  season: string;
  /** Closing outlook. */
  outlook: string;
}

interface UseTeamAnalysisResult {
  data: TeamAnalysis | undefined;
  isLoading: boolean;
}

export function useTeamAnalysis(teamId: string): UseTeamAnalysisResult {
  const teams = useTeams();
  const latest = useLatestRanking();
  const history = useRankingHistory();
  const form = useTeamRecentForm(teamId, WINDOW);
  const aggregate = useTeamAggregate(teamId, undefined, WINDOW);
  // Season baseline — the Stats pane's second column, so the narrative
  // can say whether the window is running above or below it.
  const seasonAggregate = useTeamAggregate(teamId);
  // Quarter-timing patterns — the Insights pane's Points Pattern cards.
  const scoredPattern = useTeamPointsPattern(teamId, 'scored');
  const concededPattern = useTeamPointsPattern(teamId, 'conceded');

  const data = useMemo<TeamAnalysis | undefined>(() => {
    const team = teams.data?.find((t) => t.id === teamId);
    const agg = aggregate.data;
    if (!team || !agg || agg.gamesPlayed === 0) return undefined;

    const rank = latest.data?.rows.find((r) => r.team_id === teamId)?.rank;

    // Chronological rank series across the monthly snapshots.
    const rankSeries: number[] = [];
    for (const snap of [...(history.data ?? [])].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date),
    )) {
      const row = snap.rows.find((r) => r.team_id === teamId);
      if (row) rankSeries.push(row.rank);
    }

    return {
      summary: buildSummary(team.name, rank, form.outcomes, agg),
      form: buildForm(team.name, form.outcomes, agg, seasonAggregate.data),
      ranking: buildRanking(team.name, rankSeries),
      season: buildSeason(team.name, agg, scoredPattern.data, concededPattern.data),
      outlook: buildOutlook(team.name, agg),
    };
  }, [
    teams.data,
    latest.data,
    history.data,
    form.outcomes,
    aggregate.data,
    seasonAggregate.data,
    scoredPattern.data,
    concededPattern.data,
    teamId,
  ]);

  return {
    data,
    isLoading: teams.isLoading || latest.isLoading || history.isLoading || form.isLoading || aggregate.isLoading,
  };
}

// ─── Section builders ────────────────────────────────────────────────────────

type Agg = NonNullable<ReturnType<typeof useTeamAggregate>['data']>;

function record(outcomes: readonly FormOutcome[]): { w: number; l: number; d: number } {
  let w = 0, l = 0, d = 0;
  for (const o of outcomes) o === 'W' ? w++ : o === 'L' ? l++ : d++;
  return { w, l, d };
}

function buildSummary(
  name: string,
  rank: number | undefined,
  outcomes: readonly FormOutcome[],
  agg: Agg,
): string {
  const { w, l, d } = record(outcomes);
  const rankBit = rank !== undefined ? `, ranked ${ordinal(rank)} in the world,` : '';
  const drawBit = d > 0 ? ` and ${d} drawn` : '';
  return `${name}${rankBit} have won ${w} and lost ${l}${drawBit} of their last ${agg.gamesPlayed} completed matches, scoring ${fmt(agg.perGame.pointsScored)} points per game and conceding ${fmt(agg.perGame.pointsConceded)}.`;
}

function buildForm(
  name: string,
  outcomes: readonly FormOutcome[],
  agg: Agg,
  season: Agg | undefined,
): string {
  const parts: string[] = [];
  // Current streak — outcomes arrive newest-first.
  if (outcomes.length >= STREAK_MIN) {
    const head = outcomes[0]!;
    let run = 1;
    while (run < outcomes.length && outcomes[run] === head) run++;
    if (run >= STREAK_MIN && head !== 'D') {
      parts.push(
        head === 'W'
          ? `${name} arrive on a ${run}-match winning run.`
          : `${name} are on a ${run}-match losing run.`,
      );
    }
  }
  const margin = agg.perGame.pointsScored - agg.perGame.pointsConceded;
  if (margin >= MARGIN_STRONG) {
    parts.push(
      `The underlying numbers back the results: an average winning margin of ${fmt(margin)} points across the window.`,
    );
  } else if (margin <= -MARGIN_STRONG) {
    parts.push(
      `The margins tell the harder story, with the side conceding ${fmt(Math.abs(margin))} more points per game than they score.`,
    );
  } else {
    parts.push(
      `Margins have been tight either way (${margin >= 0 ? '+' : ''}${fmt(margin)} per game), so results have turned on fine details rather than dominance.`,
    );
  }

  // Window vs season baseline — the same comparison the Stats pane's
  // two columns make. Only reported when the divergence is real (±15%)
  // and the season sample is bigger than the window itself.
  if (season && season.gamesPlayed > agg.gamesPlayed) {
    const scoredDelta = relativeDelta(agg.perGame.pointsScored, season.perGame.pointsScored);
    const concededDelta = relativeDelta(agg.perGame.pointsConceded, season.perGame.pointsConceded);
    if (scoredDelta >= BASELINE_DELTA) {
      parts.push(
        `Scoring is running above the season's established level (${fmt(agg.perGame.pointsScored)} per game in the window against ${fmt(season.perGame.pointsScored)} across the season).`,
      );
    } else if (scoredDelta <= -BASELINE_DELTA) {
      parts.push(
        `The attack has cooled relative to the season baseline (${fmt(agg.perGame.pointsScored)} per game in the window, ${fmt(season.perGame.pointsScored)} across the season).`,
      );
    }
    if (concededDelta >= BASELINE_DELTA) {
      parts.push(
        `Defensively the window is leakier than the season norm (${fmt(agg.perGame.pointsConceded)} conceded per game against ${fmt(season.perGame.pointsConceded)}).`,
      );
    } else if (concededDelta <= -BASELINE_DELTA) {
      parts.push(
        `The defence has tightened relative to the season norm (${fmt(agg.perGame.pointsConceded)} conceded per game against ${fmt(season.perGame.pointsConceded)}).`,
      );
    }
  }
  return parts.join(' ');
}

function relativeDelta(recent: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return (recent - baseline) / baseline;
}

function buildRanking(name: string, series: readonly number[]): string {
  if (series.length < 2) {
    return `There is not yet enough ranking history to read a trajectory for ${name}.`;
  }
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = first - last; // positive = climbed (lower rank number)
  if (delta >= RANK_MOVE) {
    return `The ranking curve points the right way: ${name} have climbed ${delta} places over the snapshot span, from ${ordinal(first)} to ${ordinal(last)}.`;
  }
  if (delta <= -RANK_MOVE) {
    return `The world ranking has slipped ${Math.abs(delta)} places over the snapshot span, from ${ordinal(first)} to ${ordinal(last)}, a slide the recent fixture list will need to arrest.`;
  }
  return `The world ranking has held broadly steady across the snapshot span, moving between ${ordinal(Math.min(first, last))} and ${ordinal(Math.max(first, last))}.`;
}

const QUARTER_LABELS = ['first quarter', 'second quarter', 'third quarter', 'final quarter'] as const;

function buildSeason(
  name: string,
  agg: Agg,
  scored: TeamPointsPattern | undefined,
  conceded: TeamPointsPattern | undefined,
): string {
  const g = agg.perGame;
  const parts: string[] = [];
  parts.push(
    `In attack the side average ${fmt(g.tries)} tries and ${Math.round(g.metersMade)} carry metres per game on ${Math.round(g.possessionPercent)}% possession; defensively they concede ${fmt(g.triesConceded)} tries per game on a ${Math.round(g.tackleSuccessPercent)}% tackle completion.`,
  );
  const scrum = g.scrumSuccessPercent;
  const lineout = g.lineoutSuccessPercent;
  if (scrum >= SET_PIECE_SOLID && lineout >= SET_PIECE_SOLID) {
    parts.push(
      `The set piece is a platform, with the scrum at ${Math.round(scrum)}% and the lineout at ${Math.round(lineout)}%.`,
    );
  } else if (scrum < SET_PIECE_CONCERN || lineout < SET_PIECE_CONCERN) {
    const weaker = scrum <= lineout ? `scrum (${Math.round(scrum)}%)` : `lineout (${Math.round(lineout)}%)`;
    parts.push(`The ${weaker} is leaking possession and will draw opposition attention.`);
  }
  if (g.penaltiesConceded >= PENS_HIGH) {
    parts.push(
      `Discipline is the running sore: ${fmt(g.penaltiesConceded)} penalties conceded per game keeps opponents in the contest.`,
    );
  } else if (g.penaltiesConceded <= PENS_LOW) {
    parts.push(
      `Discipline underpins it all, with just ${fmt(g.penaltiesConceded)} penalties conceded per game.`,
    );
  }

  // Scoring-timing skews — the Points Pattern cards reduced to prose.
  // Only a genuinely lopsided quarter (≥35% share) gets named.
  const scoredSkew = timingSkew(scored);
  if (scoredSkew) {
    parts.push(
      `The points arrive with a pattern: ${scoredSkew.pct}% of their scoring comes in the ${QUARTER_LABELS[scoredSkew.quarter]}.`,
    );
  }
  const concededSkew = timingSkew(conceded);
  if (concededSkew) {
    parts.push(
      `The soft period is the ${QUARTER_LABELS[concededSkew.quarter]}, where ${concededSkew.pct}% of the points against them are conceded.`,
    );
  }
  return parts.join(' ');
}

function timingSkew(
  pattern: TeamPointsPattern | undefined,
): { quarter: number; pct: number } | null {
  if (!pattern || pattern.gamesUsed === 0) return null;
  let quarter = 0;
  for (let i = 1; i < 4; i++) {
    if (pattern.avgPercentByQuarter[i]! > pattern.avgPercentByQuarter[quarter]!) quarter = i;
  }
  const pct = Math.round(pattern.avgPercentByQuarter[quarter]!);
  return pct >= TIMING_SKEW ? { quarter, pct } : null;
}

function buildOutlook(name: string, agg: Agg): string {
  const g = agg.perGame;
  // Name the single most pressing repair job, in priority order:
  // discipline, then the weaker set piece, then defensive leakage.
  if (g.penaltiesConceded >= PENS_HIGH) {
    return `Going forward, the penalty count is the first fix for ${name}: cheap territory handed over at ${fmt(g.penaltiesConceded)} a game undoes good work everywhere else.`;
  }
  const scrum = g.scrumSuccessPercent;
  const lineout = g.lineoutSuccessPercent;
  if (scrum < SET_PIECE_CONCERN || lineout < SET_PIECE_CONCERN) {
    const weaker = scrum <= lineout ? 'scrum' : 'lineout';
    return `Going forward, shoring up the ${weaker} is the priority; a reliable set-piece platform is what turns pressure into points at this level.`;
  }
  if (g.pointsConceded > g.pointsScored) {
    return `Going forward, the balance needs to shift: ${name} are creating enough, but conceding ${fmt(g.pointsConceded)} points per game means the attack is chasing the game too often.`;
  }
  return `Going forward, the task for ${name} is to hold this standard: the profile is sound across the board, and consistency is what converts a good window into silverware.`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
