import { useMemo } from 'react';

import { useLatestRanking, useRankingHistory, useTeams, useTeamsFormSummary } from '@/api/hooks';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamPointsPattern, type TeamPointsPattern } from '@/hooks/use-team-points-pattern';
import { useTeamMatchSeries } from '@/hooks/use-team-match-series';
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

/**
 * STRICT 1:1 with the Team Preview carousel: one narrative per card,
 * section labels identical to card titles (owner rule 2026-07-07 —
 * consistency, never "reading between the lines"). Field order = card
 * order.
 */
export interface TeamAnalysis {
  /** Unlabeled cold-open (title-row body; evidence = Team Profile). */
  summary: string;
  /** "Team Form" — recent results: record, streak, margin. */
  form: string;
  /** "Team World Ranking" — trajectory over the snapshot span. */
  ranking: string;
  /** "Team Landscape" — pool-relative standing, quadrant named. */
  landscape: string;
  /** "Team Efficiency KPIs" — the per-game profile: attack, defence. */
  kpis: string;
  /** "Scoring Rhythm" — quarter-timing read (explicit when even). */
  rhythm: string;
  /** "Possession vs Outcome" — how the wins arrive. */
  possession: string;
  /** "Set Piece & Discipline" — platform + whistle status, then the
   *  most pressing repair job. */
  setPieceDiscipline: string;
  /** "Discipline Trend" — the per-match penalty habit and direction. */
  disciplineTrend: string;
  /** "Aerial Contest" — contestable kicks delivered/received won-rates
   *  against the Tier-1 baselines. */
  aerial: string;
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
  // Pool context for the Landscape read + per-match possession/margin
  // pairs for the Possession read — same windows as their charts.
  const pool = useTeamsFormSummary();
  const series = useTeamMatchSeries(teamId, WINDOW);

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
      landscape: buildLandscape(team.name, teamId, agg, pool.data ?? []),
      kpis: buildKpis(agg),
      rhythm: buildRhythm(scoredPattern.data, concededPattern.data),
      possession: buildPossession(team.name, series.data),
      setPieceDiscipline: buildSetPieceDiscipline(team.name, agg),
      disciplineTrend: buildDisciplineTrend(team.name, series.data),
      aerial: buildAerial(team.name, agg),
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
    pool.data,
    series.data,
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
  const g = agg.perGame;
  const diff = g.pointsScored - g.pointsConceded;
  const parts: string[] = [];
  parts.push(
    `${name}${rankBit} have won ${w} and lost ${l}${drawBit} of their last ${agg.gamesPlayed} completed matches, scoring ${fmt(g.pointsScored)} points a game and conceding ${fmt(g.pointsConceded)}.`,
  );
  parts.push(
    diff >= 0
      ? `That leaves the ledger ${fmt(diff)} points a game in credit across the window.`
      : `That leaves the ledger ${fmt(Math.abs(diff))} points a game in the red across the window.`,
  );
  parts.push(
    `Tries have flowed at ${fmt(g.tries)} a game for and ${fmt(g.triesConceded)} against.`,
  );
  parts.push(
    `Behind the scorelines the side have taken ${Math.round(g.possessionPercent)}% of the ball and ${Math.round(g.territoryPercent)}% of the ground, carrying for ${Math.round(g.metersMade)} metres a match.`,
  );
  parts.push(
    `Every read on this card is built from that ${agg.gamesPlayed}-match sample, and each section below takes one slice of it.`,
  );
  return parts.join(' ');
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

  // Supporting record detail, then colour — later sentences are the
  // first the card-fit packer drops on smaller cards.
  const { w, l, d } = record(outcomes);
  if (outcomes.length > 0) {
    const shown = Math.min(outcomes.length, 5);
    const seq = outcomes.slice(0, shown).slice().reverse().join('-');
    parts.push(
      `Read oldest to newest, the last ${shown} results run ${seq}, inside a window record of ${w}-${l}${d > 0 ? `-${d}` : ''}.`,
    );
    parts.push(
      `That return of ${w} win${w === 1 ? '' : 's'} from ${outcomes.length} completed starts runs at ${Math.round((w / outcomes.length) * 100)}%.`,
    );
  }
  parts.push(
    `Tries frame the same stretch at ${fmt(agg.perGame.tries)} a game scored and ${fmt(agg.perGame.triesConceded)} conceded.`,
  );
  if (parts.join(' ').length < 620) {
    parts.push(
      `Summed across the ${agg.gamesPlayed} matches, the window totals ${Math.round(agg.perGame.pointsScored * agg.gamesPlayed)} points scored and ${Math.round(agg.perGame.pointsConceded * agg.gamesPlayed)} conceded.`,
    );
  }
  if (parts.join(' ').length < 650) {
    parts.push(
      `Form windows roll, and the oldest of these results drops out the next time a fixture completes.`,
    );
  }
  return parts.join(' ');
}

function relativeDelta(recent: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return (recent - baseline) / baseline;
}

function buildRanking(name: string, series: readonly number[]): string {
  if (series.length < 2) {
    return `A trajectory read has to wait: ranking history for ${name} is not yet deep enough to call a direction. Snapshots land monthly, and at least two are needed before a climb, a slide, or a hold means anything. The next update starts the clock.`;
  }
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = first - last; // positive = climbed (lower rank number)

  let lead: string;
  const extras: string[] = [];
  if (delta >= RANK_MOVE) {
    lead = `Across the snapshot span the world ranking has moved the right way, from ${ordinal(first)} to ${ordinal(last)}, and the wider table now reflects what the window has produced.`;
    extras.push(`That is ${delta} places recovered since the first snapshot in view.`);
  } else if (delta <= -RANK_MOVE) {
    lead = `The slide is unmistakable: ${ordinal(first)} to ${ordinal(last)} over the snapshot span, and only results will arrest it.`;
    extras.push(`That is ${Math.abs(delta)} places surrendered since the first snapshot in view.`);
  } else {
    const lo = Math.min(first, last);
    const hi = Math.max(first, last);
    lead =
      lo === hi
        ? `The world ranking has barely breathed: ${ordinal(first)} at both ends of the snapshot span.`
        : `Steadiness is the ranking story: between ${ordinal(lo)} and ${ordinal(hi)} across the span, never enough movement either way to call a trend.`;
  }

  // Band, volatility, and the current position — supporting context in
  // trim order.
  const best = Math.min(...series);
  const worst = Math.max(...series);
  let biggest = 0;
  let moved = 0;
  for (let i = 1; i < series.length; i++) {
    const step = Math.abs(series[i]! - series[i - 1]!);
    if (step > 0) moved++;
    if (step > biggest) biggest = step;
  }
  const held = series.length - 1 - moved;
  extras.push(
    `Between those endpoints the position has ranged from ${ordinal(best)} at its highest to ${ordinal(worst)} at its lowest across ${series.length} monthly snapshots.`,
  );
  extras.push(
    biggest > 0
      ? `The sharpest single month moved the side ${biggest} place${biggest === 1 ? '' : 's'}, and ${moved} of the ${series.length - 1} month-on-month steps produced movement while ${held} held flat.`
      : `Not a single month-on-month step has shifted the number.`,
  );
  extras.push(
    `Today the table says ${ordinal(last)}, and that is the position every pre-match billing now gets built on.`,
  );
  return [lead, ...extras].join(' ');
}

const QUARTER_LABELS = ['first quarter', 'second quarter', 'third quarter', 'final quarter'] as const;

/** "Team Efficiency KPIs" — the per-game statistical profile. */
function buildKpis(agg: Agg): string {
  const g = agg.perGame;
  const parts: string[] = [];
  parts.push(
    `In attack the side turn ${Math.round(g.possessionPercent)}% possession into ${fmt(g.tries)} tries a game.`,
  );
  parts.push(`Ball in hand, the carry game covers ${Math.round(g.metersMade)} metres a match.`);
  parts.push(
    `The ${fmt(g.lineBreaks)} line breaks a game measure how often those carries actually split the defence.`,
  );
  parts.push(
    `The defensive ledger reads ${fmt(g.triesConceded)} tries conceded a game behind a ${Math.round(g.tackleSuccessPercent)}% tackle completion.`,
  );
  parts.push(
    `Territory pressure has been cashed at ${fmt(g.pointsPerTwentyTwoEntry)} points per visit across ${fmt(g.twentyTwoEntries)} entries into the opposition 22 a game.`,
  );
  parts.push(
    `Off the tee, ${Math.round(g.goalKickingPercent)}% of the shots at goal have gone over.`,
  );
  parts.push(
    `Ball security runs to ${fmt(g.handlingErrors)} handling errors and ${fmt(g.turnoversConceded)} turnovers conceded a game, with ${fmt(g.turnoversWon)} won back at the contact area.`,
  );
  parts.push(
    `Those are the baselines every match performance gets measured against.`,
  );
  return parts.join(' ');
}

/** Tier-1 aerial baselines — mirror the synthetic generator's band
 *  (regather 25-60% of own contestables). Replace with live pool
 *  averages at real-data cutover, same as the KPI card's T1 marks. */
const T1_AERIAL = { deliveredWonPercent: 43, receivedWonPercent: 57 };

function buildAerial(teamName: string, agg: Agg): string {
  const g = agg.perGame;
  const del = Math.round(g.deliveredWonPercent);
  const rec = Math.round(g.receivedWonPercent);
  const volume = `${fmt(g.contestablesDelivered)} contestables kicked and ${fmt(g.contestablesReceived)} received a game`;
  const delStrong = del >= T1_AERIAL.deliveredWonPercent + 5;
  const delWeak = del <= T1_AERIAL.deliveredWonPercent - 5;
  const recStrong = rec >= T1_AERIAL.receivedWonPercent + 5;
  const recWeak = rec <= T1_AERIAL.receivedWonPercent - 5;

  const delRead = delStrong
    ? `Regathering ${del}% of their own kicks makes the bomb a genuine possession weapon`
    : delWeak
      ? `Regathering just ${del}% of their own kicks, every hopeful bomb is a possession donated`
      : `A ${del}% regather rate on their own kicks is par for this level`;
  const recRead = recStrong
    ? `under the high ball the back field is a strength, securing ${rec}% of what comes down`
    : recWeak
      ? `the back field is the soft spot — only ${rec}% of received contestables are secured, and opponents will have noticed`
      : `the back field holds its own at ${rec}% security on receptions`;

  const rel = (v: number, base: number): string =>
    v === base
      ? 'level with'
      : v > base
        ? `${v - base} point${v - base === 1 ? '' : 's'} above`
        : `${base - v} point${base - v === 1 ? '' : 's'} below`;

  const parts: string[] = [];
  parts.push(`${teamName} live an average aerial life by volume — ${volume}. ${delRead}; ${recRead}.`);
  parts.push(
    `The Tier-1 reference marks are ${T1_AERIAL.deliveredWonPercent}% on kicks delivered and ${T1_AERIAL.receivedWonPercent}% on kicks received, the ruler both numbers are held against.`,
  );
  parts.push(
    `That puts the delivery game ${rel(del, T1_AERIAL.deliveredWonPercent)} the mark and the back field ${rel(rec, T1_AERIAL.receivedWonPercent)} it.`,
  );
  parts.push(
    `The wider boot runs to ${fmt(g.kicksInPlay)} kicks in play a game for ${Math.round(g.kickMeters)} kick metres, so the contest numbers sit inside a genuine kicking volume.`,
  );
  parts.push(
    `One mistimed jump swings a contest this fine, and over eighty minutes the percentages either buy territory back or hand it over.`,
  );
  return parts.join(' ');
}

/** "Scoring Rhythm" — the quarter-timing read; explicit when even. */
function buildRhythm(
  scored: TeamPointsPattern | undefined,
  conceded: TeamPointsPattern | undefined,
): string {
  const scoredSkew = timingSkew(scored);
  const concededSkew = timingSkew(conceded);
  const hasScored = scored !== undefined && scored.gamesUsed > 0;
  const hasConceded = conceded !== undefined && conceded.gamesUsed > 0;
  const parts: string[] = [];
  if (scoredSkew) {
    parts.push(
      `The scoring carries a clock, with ${scoredSkew.pct}% of the points arriving in the ${QUARTER_LABELS[scoredSkew.quarter]}.`,
    );
  }
  if (concededSkew) {
    parts.push(
      `The soft period sits in the ${QUARTER_LABELS[concededSkew.quarter]}, which absorbs ${concededSkew.pct}% of the points conceded.`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      `No quarter habit stands out at either end — the points have arrived and leaked evenly across the eighty, which reads as consistency rather than a window to attack.`,
    );
    if (!hasScored && !hasConceded) return parts[0]!;
    parts.push(
      `Evenness of this kind denies opponents a target window, and that is its own kind of edge.`,
    );
  } else if (scoredSkew && concededSkew && scoredSkew.quarter === concededSkew.quarter) {
    parts.push(`The same window carries both stories, which makes it the quarter the match lives or dies in.`);
  }

  // Half-splits and the quiet period — supporting detail in trim order.
  if (hasScored) {
    const q = scored.avgPercentByQuarter;
    const beforeBreak = Math.round(q[0] + q[1]);
    parts.push(
      `Split by halves, ${beforeBreak}% of the scoring has arrived before the interval and the rest after it.`,
    );
    let quiet = 0;
    for (let i = 1; i < 4; i++) {
      if (q[i]! < q[quiet]!) quiet = i;
    }
    parts.push(
      `The quietest attacking period has been the ${QUARTER_LABELS[quiet]}, carrying just ${Math.round(q[quiet]!)}% of the points scored.`,
    );
  }
  if (hasConceded) {
    const c = conceded.avgPercentByQuarter;
    parts.push(
      `At the other end, ${Math.round(c[2] + c[3])}% of the points conceded have come after half-time.`,
    );
  }
  if (hasScored) {
    parts.push(
      `Every match weighs equally in the pattern regardless of scoreline, averaged across ${scored.gamesUsed} completed fixtures.`,
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

/**
 * Pool-relative standing — the Team Landscape 2×2 in prose. Attack and
 * defence measured against the POOL MEDIANS (the chart's crosshairs),
 * quadrant named in the chart's own vocabulary so the two readings
 * can't drift.
 */
function buildLandscape(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const peers = pool.filter((r) => r.games_played > 0);
  if (peers.length < 4) {
    return `The pool picture is still forming — too few sides have a meaningful sample to place ${teamName} against. Four sides with completed matches is the minimum for medians that mean anything, so the quadrant call stays blank rather than guessed.`;
  }
  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };
  const medFor = median(peers.map((r) => r.per_game.pointsScored ?? 0));
  const medAgainst = median(peers.map((r) => r.per_game.pointsConceded ?? 0));
  const attack = agg.perGame.pointsScored;
  const defence = agg.perGame.pointsConceded;
  const attackAbove = attack > medFor;
  const defenceTight = defence < medAgainst;

  // Shared supporting context, appended to every quadrant verdict in
  // trim order: exact deltas to the crosshairs, pool position counts,
  // then the sample caveat.
  const others = peers.filter((r) => r.team_id !== teamId);
  const scoreMore = others.filter((r) => (r.per_game.pointsScored ?? 0) > attack).length;
  const concedeLess = others.filter((r) => (r.per_game.pointsConceded ?? 0) < defence).length;
  const attackGap = attack - medFor;
  const defenceGap = medAgainst - defence; // positive = tighter than median
  const scoreMoreBit =
    scoreMore === 0
      ? `No other side in the pool scores more heavily`
      : scoreMore === 1
        ? `Only one of the ${others.length} other sides scores more heavily`
        : `${scoreMore} of the ${others.length} other sides score more heavily`;
  const concedeLessBit =
    concedeLess === 0
      ? `none concedes less`
      : concedeLess === 1
        ? `one concedes less`
        : `${concedeLess} concede less`;
  const extras = [
    `Measured to the crosshairs, the attack sits ${fmt(Math.abs(attackGap))} points a game ${attackGap >= 0 ? 'above' : 'below'} the pool median and the defence ${fmt(Math.abs(defenceGap))} ${defenceGap >= 0 ? 'inside' : 'outside'} it.`,
    `${scoreMoreBit}, and ${concedeLessBit}.`,
    `Those medians are drawn from ${peers.length} sides with completed matches, so the crosshairs shift as the pool plays and the quadrant call is only as current as the latest round.`,
  ].join(' ');

  if (attackAbove && defenceTight) {
    return `Set against the whole pool, ${teamName} have held the complete quadrant: ${attack.toFixed(1)} a game scored against a median of ${medFor.toFixed(1)}, with the defence also inside the pool line. Owning both halves of the map is rare, and it is what separates contenders from good sides. ${extras}`;
  }
  if (!attackAbove && defenceTight) {
    return `${teamName} have lived in the grinders' quadrant: the defence has stayed tighter than the pool median while the attack has run at ${attack.toFixed(1)} a game, short of the median ${medFor.toFixed(1)}. Sides shaped like this stay in matches — the question has been finding the points to win them. ${extras}`;
  }
  if (attackAbove && !defenceTight) {
    return `The map places ${teamName} with the entertainers: ${attack.toFixed(1)} a game scored, clear of the pool median, but ${defence.toFixed(1)} shipped the other way. Matches like theirs have been decided by whichever end of the pitch blinks first. ${extras}`;
  }
  return `Against the pool ${teamName} have sat in the exposed quadrant — below the median with the ball and leakier than it without: ${attack.toFixed(1)} for, ${defence.toFixed(1)} against. Every route out of that corner starts with the defence. ${extras}`;
}

/**
 * How the team wins — the Possession vs Outcome scatter in prose:
 * whether wins have come with the majority of the ball or without it,
 * and whether possession has been converting at all.
 */
function buildPossession(
  teamName: string,
  series: readonly { outcome: 'W' | 'L' | 'D'; margin: number; possessionPercent: number }[] | undefined,
): string {
  const rows = series ?? [];
  if (rows.length === 0) {
    return `Not enough completed matches yet to read how ${teamName} use the ball.`;
  }
  const wins = rows.filter((r) => r.outcome === 'W');
  const losses = rows.filter((r) => r.outcome === 'L');
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const avgPossAll = avg(rows.map((r) => r.possessionPercent));

  // Supporting detail shared by every branch, in trim order: overall
  // share, what the wins paid, what the defeats cost, then colour.
  const extras: string[] = [];
  extras.push(
    `Averaged over all ${rows.length} completed matches the share of ball is ${avgPossAll.toFixed(0)}%.`,
  );
  if (wins.length > 0) {
    const maxWin = Math.max(...wins.map((r) => r.margin));
    extras.push(
      `Winning days have paid at ${fmt(avg(wins.map((r) => r.margin)))} points a time, the best of them by ${maxWin}.`,
    );
  }
  if (losses.length > 0) {
    const worstLoss = Math.min(...losses.map((r) => r.margin));
    extras.push(
      `The ${losses.length} defeat${losses.length === 1 ? ' has' : 's have'} cost ${fmt(Math.abs(avg(losses.map((r) => r.margin))))} points on average, the heaviest by ${Math.abs(worstLoss)}.`,
    );
  }
  extras.push(
    `Possession only counts when it converts, and the scatter is a map of when it has and when it has not.`,
  );

  if (wins.length === 0) {
    const core =
      avgPossAll >= 50
        ? `No wins in the window, and not for lack of ball: ${teamName} have averaged ${avgPossAll.toFixed(0)}% possession across the run. That is the wasted-ball corner of the map — control without conversion — and it is the most fixable failure mode in rugby.`
        : `No wins in the window, and the shape of the map says why: ${teamName} have been outplayed for ball (${avgPossAll.toFixed(0)}% on average) and outscored with it. Until the possession share recovers, everything else is patching.`;
    return [core, ...extras].join(' ');
  }

  const winsWithBall = wins.filter((r) => r.possessionPercent >= 50).length;
  const avgPossWins = avg(wins.map((r) => r.possessionPercent));
  const lossesWithBall = losses.filter((r) => r.possessionPercent >= 50);
  const wastedBall =
    losses.length > 0 && lossesWithBall.length >= Math.ceil(losses.length / 2);

  let core: string;
  if (winsWithBall === wins.length) {
    core = `Every win in the window has come with the majority of the ball (${avgPossWins.toFixed(0)}% on average) — ${teamName} have won by taking control first and asking questions after.`;
  } else if (winsWithBall === 0) {
    core = `The wins have all come WITHOUT the ball — ${avgPossWins.toFixed(0)}% possession on average in victory. ${teamName} have been a counter-punching side: soak, strike, scoreboard.`;
  } else {
    core = `${winsWithBall} of ${wins.length} wins have come with the majority of the ball, the rest on the counter — ${teamName} have shown they can win the match both ways, which is the hardest profile to plan against.`;
  }
  if (wastedBall) {
    core = `${core} The warning sits on the other side of the map: most of the defeats have come WITH the ball, and possession that doesn't convert is an invitation.`;
  }
  return [core, ...extras].join(' ');
}

/** "Set Piece & Discipline" — platform + whistle status, closed by
 *  the single most pressing repair job (priority: discipline → weaker
 *  set piece → defensive leakage → consolidation). */
function buildSetPieceDiscipline(name: string, agg: Agg): string {
  const g = agg.perGame;
  const scrum = g.scrumSuccessPercent;
  const lineout = g.lineoutSuccessPercent;
  const bothSolid = scrum >= SET_PIECE_SOLID && lineout >= SET_PIECE_SOLID;

  const status: string[] = [];
  if (bothSolid) {
    status.push(
      `The set piece is a platform rather than a worry: ${Math.round(scrum)}% at the scrum, ${Math.round(lineout)}% at the lineout.`,
    );
  }
  if (g.penaltiesConceded <= PENS_LOW) {
    status.push(
      `Discipline underpins the whole operation: just ${fmt(g.penaltiesConceded)} penalties conceded a game.`,
    );
  }
  const opener = status.length > 0 ? `${status.join(' ')} ` : '';

  // Supporting sentences shared across branches, in trim order.
  const platformNumbers = `The platforms read ${Math.round(scrum)}% at the scrum and ${Math.round(lineout)}% at the lineout.`;
  const pensMid =
    g.penaltiesConceded > PENS_LOW && g.penaltiesConceded < PENS_HIGH
      ? `The penalty count sits at ${fmt(g.penaltiesConceded)} a game, between the bands, liveable without being clean.`
      : undefined;
  const tail: string[] = [];
  if (g.yellowCards >= 0.05) {
    tail.push(
      `Cards add to the bill at ${fmt(g.yellowCards)} yellows a game${g.redCards >= 0.05 ? ` plus ${fmt(g.redCards)} reds` : ''}.`,
    );
  }
  tail.push(
    `All of it feeds a territory share of ${Math.round(g.territoryPercent)}%, the ground a platform game is supposed to buy.`,
  );
  tail.push(
    `Set piece and whistle are the two levers a training week can genuinely move, which is why the repair order starts here.`,
  );

  if (g.penaltiesConceded >= PENS_HIGH) {
    const parts = [
      `The repair job starts at the whistle. ${name} are conceding ${fmt(g.penaltiesConceded)} penalties a game, and no other improvement pays off while territory and easy points are handed over at that rate.`,
      `Behind the whistle count, ${platformNumbers.charAt(0).toLowerCase()}${platformNumbers.slice(1)}`,
      ...tail,
    ];
    return parts.join(' ');
  }
  if (scrum < SET_PIECE_CONCERN || lineout < SET_PIECE_CONCERN) {
    const weaker = scrum <= lineout ? 'scrum' : 'lineout';
    const stronger = scrum <= lineout ? 'lineout' : 'scrum';
    const weakerPct = Math.round(scrum <= lineout ? scrum : lineout);
    const strongerPct = Math.round(Math.max(scrum, lineout));
    const parts = [
      `${opener}The priority is the ${weaker}: at ${weakerPct}%, it hands back possession that opponents will have circled, and until that platform steadies good field position will keep dissolving at the moment it should pay off.`,
      `The ${stronger} has held firmer at ${strongerPct}%.`,
      ...(pensMid ? [pensMid] : []),
      ...tail,
    ];
    return parts.join(' ');
  }
  if (g.pointsConceded > g.pointsScored) {
    const parts = [
      `${opener}The balance has to shift first: ${name} concede more than they score (${fmt(g.pointsConceded)} points a game against them), and that arithmetic forces the attack to chase every contest.`,
      ...(bothSolid ? [] : [platformNumbers]),
      ...(pensMid ? [pensMid] : []),
      ...tail,
    ];
    return parts.join(' ');
  }
  const parts = [
    `${opener}No single repair job stands out beyond that for ${name}; the profile holds across every dimension measured here. The task now is repetition, holding this standard long enough for a good stretch to become an identity.`,
    ...(bothSolid ? [] : [platformNumbers]),
    ...(pensMid ? [pensMid] : []),
    ...tail,
  ];
  return parts.join(' ');
}

/** "Discipline Trend" — the per-match penalty habit: level against
 *  the narrative bands (≤9 disciplined, ≥12 a problem) and direction
 *  across the window (recent half vs earlier half). */
function buildDisciplineTrend(
  name: string,
  series: readonly { penaltiesConceded: number }[] | undefined,
): string {
  const rows = series ?? [];
  if (rows.length < 4) {
    return `Not enough completed matches yet to read ${name}'s penalty habit.`;
  }
  const pens = rows.map((r) => r.penaltiesConceded);
  const avg = pens.reduce((a, b) => a + b, 0) / pens.length;
  const half = Math.floor(pens.length / 2);
  const earlier = pens.slice(0, half);
  const recent = pens.slice(half);
  const avgOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const drift = avgOf(recent) - avgOf(earlier);

  const level =
    avg >= PENS_HIGH
      ? `${name} have run at ${fmt(avg)} penalties a game across the window — above the line where the whistle becomes a scoreboard problem.`
      : avg <= PENS_LOW
        ? `${name} have kept the count at ${fmt(avg)} penalties a game — inside the disciplined band, and almost nothing has been given away for free.`
        : `${name} have sat at ${fmt(avg)} penalties a game — between the bands, liveable but with no margin for a bad night.`;

  const direction =
    drift >= 1.5
      ? `The direction is the worry: the recent half of the run has been ${fmt(drift)} a game worse than the earlier half, and that trend usually reaches the scoreboard within a match or two.`
      : drift <= -1.5
        ? `The direction is the encouraging part — the recent half of the run has been ${fmt(Math.abs(drift))} a game cleaner than the earlier half.`
        : `The count has held steady across the run, so it reads as a habit rather than a phase.`;

  // Range, threshold breaches, latest match — supporting detail in
  // trim order, colour last.
  const minP = Math.min(...pens);
  const maxP = Math.max(...pens);
  const over = pens.filter((p) => p >= PENS_HIGH).length;
  const latest = pens[pens.length - 1]!;
  const extras: string[] = [];
  extras.push(`Match to match the count has run between ${fmt(minP)} and ${fmt(maxP)}.`);
  extras.push(
    over > 0
      ? `${over} of the ${pens.length} matches crossed the ${PENS_HIGH}-penalty line where the whistle starts writing the scoreboard.`
      : `Not one of the ${pens.length} matches crossed the ${PENS_HIGH}-penalty line.`,
  );
  extras.push(
    `The most recent completed fixture brought ${fmt(latest)}, ${latest > avg ? 'above' : latest < avg ? 'below' : 'level with'} the window's own average.`,
  );
  extras.push(
    `Penalty counts travel with a side's reputation, so the direction of the habit matters as much as any single night's number.`,
  );
  return [level, direction, ...extras].join(' ');
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
