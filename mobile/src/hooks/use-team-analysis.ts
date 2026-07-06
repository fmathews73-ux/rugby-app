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
  // Quarter-timing patterns — same prev-10 window as every other read.
  const scoredPattern = useTeamPointsPattern(teamId, 'scored', undefined, WINDOW);
  const concededPattern = useTeamPointsPattern(teamId, 'conceded', undefined, WINDOW);

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
  return `${name}${rankBit} have won ${w} and lost ${l}${drawBit} of their last ${agg.gamesPlayed} completed matches, scoring ${fmt(agg.perGame.pointsScored)} points a game and conceding ${fmt(agg.perGame.pointsConceded)}.`;
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
          ? `The streak is the headline: ${name} arrive on ${run} straight wins.`
          : `The slide is the headline: ${run} defeats in a row, a run now long enough to be a pattern rather than a blip.`,
      );
    }
  }
  const margin = agg.perGame.pointsScored - agg.perGame.pointsConceded;
  if (margin >= MARGIN_STRONG) {
    parts.push(
      `The dominance is real rather than flattering: an average winning margin of ${fmt(margin)} points across the window.`,
    );
  } else if (margin <= -MARGIN_STRONG) {
    parts.push(
      `Margins deepen the concern: on average the side concede ${fmt(Math.abs(margin))} more points than they score, a stretch of being outplayed rather than edged.`,
    );
  } else {
    parts.push(
      `Nothing in the stretch has been comfortable: at ${margin >= 0 ? '+' : ''}${fmt(margin)} a game the margins are tight, and results have turned on fine details rather than control.`,
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
        `This window is running hotter than the season around it, ${fmt(agg.perGame.pointsScored)} points a game against a full-season line of ${fmt(season.perGame.pointsScored)}.`,
      );
    } else if (scoredDelta <= -BASELINE_DELTA) {
      parts.push(
        `Scoring has cooled below the side's own season level, down to ${fmt(agg.perGame.pointsScored)} a game from ${fmt(season.perGame.pointsScored)} across the campaign.`,
      );
    }
    if (concededDelta >= BASELINE_DELTA) {
      parts.push(
        `The other end carries the warning: ${fmt(agg.perGame.pointsConceded)} conceded a game in this window, clear of the season norm of ${fmt(season.perGame.pointsConceded)}.`,
      );
    } else if (concededDelta <= -BASELINE_DELTA) {
      parts.push(
        `Defensively the window marks a tightening, ${fmt(agg.perGame.pointsConceded)} conceded a game against ${fmt(season.perGame.pointsConceded)} across the season.`,
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
    return `A trajectory read has to wait: ranking history for ${name} is not yet deep enough to call a direction.`;
  }
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = first - last; // positive = climbed (lower rank number)
  if (delta >= RANK_MOVE) {
    return `Across the snapshot span the world ranking has moved the right way, from ${ordinal(first)} to ${ordinal(last)}, and the wider table now reflects what the window has produced.`;
  }
  if (delta <= -RANK_MOVE) {
    return `The slide is unmistakable: ${ordinal(first)} to ${ordinal(last)} over the snapshot span, and only results will arrest it.`;
  }
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  if (lo === hi) {
    return `The world ranking has barely breathed: ${ordinal(first)} at both ends of the snapshot span.`;
  }
  return `Steadiness is the ranking story: between ${ordinal(lo)} and ${ordinal(hi)} across the span, never enough movement either way to call a trend.`;
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
    `In attack the side turn ${Math.round(g.possessionPercent)}% possession into ${fmt(g.tries)} tries a game.`,
  );
  parts.push(`Ball in hand, the carry game covers ${Math.round(g.metersMade)} metres a match.`);
  parts.push(
    `The defensive ledger reads ${fmt(g.triesConceded)} tries conceded a game behind a ${Math.round(g.tackleSuccessPercent)}% tackle completion.`,
  );
  const scrum = g.scrumSuccessPercent;
  const lineout = g.lineoutSuccessPercent;
  if (scrum >= SET_PIECE_SOLID && lineout >= SET_PIECE_SOLID) {
    parts.push(
      `The set piece is a platform rather than a worry: ${Math.round(scrum)}% at the scrum, ${Math.round(lineout)}% at the lineout.`,
    );
  } else if (scrum < SET_PIECE_CONCERN || lineout < SET_PIECE_CONCERN) {
    const weakerIsScrum = scrum <= lineout;
    parts.push(
      `The ${weakerIsScrum ? 'scrum' : 'lineout'} is the leak: at ${Math.round(weakerIsScrum ? scrum : lineout)}%, it hands back possession that opponents will have circled.`,
    );
  }
  if (g.penaltiesConceded >= PENS_HIGH) {
    parts.push(
      `Discipline bleeds into everything else, because ${fmt(g.penaltiesConceded)} penalties a game is a steady feed of territory and shots at goal for the opposition.`,
    );
  } else if (g.penaltiesConceded <= PENS_LOW) {
    parts.push(
      `Discipline underpins the whole operation: just ${fmt(g.penaltiesConceded)} penalties conceded a game, and with them almost nothing given away for free.`,
    );
  }

  // Scoring-timing skews — the Points Pattern cards reduced to prose.
  // Only a genuinely lopsided quarter (≥35% share) gets named.
  const scoredSkew = timingSkew(scored);
  if (scoredSkew) {
    parts.push(
      `The scoring carries a clock, with ${scoredSkew.pct}% of the points arriving in the ${QUARTER_LABELS[scoredSkew.quarter]}.`,
    );
  }
  const concededSkew = timingSkew(conceded);
  if (concededSkew) {
    parts.push(
      `The soft period sits in the ${QUARTER_LABELS[concededSkew.quarter]}, which absorbs ${concededSkew.pct}% of the points conceded.`,
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
    return `The repair job starts at the whistle. ${name} are conceding ${fmt(g.penaltiesConceded)} penalties a game, and no other improvement pays off while territory and easy points are handed over at that rate.`;
  }
  const scrum = g.scrumSuccessPercent;
  const lineout = g.lineoutSuccessPercent;
  if (scrum < SET_PIECE_CONCERN || lineout < SET_PIECE_CONCERN) {
    const weaker = scrum <= lineout ? 'scrum' : 'lineout';
    return `The priority is the ${weaker}. Until that platform steadies, good field position will keep dissolving at the moment it should pay off.`;
  }
  if (g.pointsConceded > g.pointsScored) {
    return `The balance has to shift first: ${name} concede more than they score (${fmt(g.pointsConceded)} points a game against them), and that arithmetic forces the attack to chase every contest.`;
  }
  return `No single repair job stands out for ${name}; the profile holds across every dimension measured here. The task now is repetition, holding this standard long enough for a good stretch to become an identity.`;
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
