import { useMemo } from 'react';

import { useLatestRanking, useRankingHistory, useTeams, useTeamsFormSummary } from '@/api/hooks';
import { TIER_1_IDS } from '@/lib/tiers';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { type TeamPointsPattern } from '@/hooks/use-team-points-pattern';
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
  /** "Scoring Rhythm" — quarter-timing read (explicit when even). */
  rhythm: string;
  /** "Possession vs Outcome" — how the wins arrive. */
  possession: string;
  /** "Set Piece & Discipline" — platform + whistle status, then the
   *  most pressing repair job. */
  setPieceDiscipline: string;
  /** Defensive Integrity matrix read — completion vs breaks conceded. */
  defensiveIntegrity: string;
  /** Red Zone matrix read — attack volume vs conversion. */
  redZone: string;
  /** Breakdown trade read — turnovers won vs the whistle count. */
  breakdownTrade: string;
  /** Boot ROI read — kick metres vs territory bought. */
  bootRoi: string;
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
      rhythm: buildRhythm(team.name, teamId, agg, pool.data ?? []),
      possession: buildPossession(team.name, teamId, agg, pool.data ?? []),
      setPieceDiscipline: buildSetPieceDiscipline(team.name, agg),
      defensiveIntegrity: buildDefensiveIntegrity(team.name, teamId, agg, pool.data ?? []),
      redZone: buildRedZone(team.name, teamId, agg, pool.data ?? []),
      breakdownTrade: buildBreakdownTrade(team.name, teamId, agg, pool.data ?? []),
      bootRoi: buildBootRoi(team.name, teamId, agg, pool.data ?? []),
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

/**
 * Rhythm matrix read — first-half vs second-half scoring inside the
 * tier, with the margin (the chart's dot size) as supporting context.
 */
function buildRhythm(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'firstHalfPointsScored', 'secondHalfPointsScored');
  if (!m) {
    return `The tier picture is still forming — too few sides have completed matches to read ${teamName}'s scoring rhythm against. Four is the minimum for medians that mean anything.`;
  }
  const firstHalf = agg.perGame.firstHalfPointsScored;
  const secondHalf = agg.perGame.secondHalfPointsScored;
  const margin = agg.perGame.pointsScored - agg.perGame.pointsConceded;
  const fastStart = firstHalf > m.medX;
  const strongFinish = secondHalf > m.medY;
  const marginPhrase = `${margin >= 0 ? 'plus' : 'minus'}-${fmt(Math.abs(margin))}`;
  const extras = [
    `To the crosshairs, the first-half output runs ${fmt(Math.abs(firstHalf - m.medX))} points ${firstHalf >= m.medX ? 'above' : 'below'} the tier median and the second-half output ${fmt(Math.abs(secondHalf - m.medY))} ${secondHalf >= m.medY ? 'above' : 'below'} it.`,
    `The dot size carries the outcome: this side's margin runs ${marginPhrase} a game.`,
    POOL_CAVEAT,
  ].join(' ');
  if (fastStart && strongFinish) {
    return `${teamName} score for the full eighty: ${fmt(firstHalf)} points a game before the interval and ${fmt(secondHalf)} after it, both above the tier line. There is no cheap twenty minutes against a profile like this. ${extras}`;
  }
  if (!fastStart && strongFinish) {
    return `${teamName} are the tier's slow burners: ${fmt(firstHalf)} first-half points a game, under the tier line, then ${fmt(secondHalf)} after the break. The scoring arrives once the game loosens, so the first job against them is not to be level at the hour. ${extras}`;
  }
  if (fastStart && !strongFinish) {
    return `${teamName} are fast starters: ${fmt(firstHalf)} points a game before half-time, above the tier line, fading to ${fmt(secondHalf)} after it. The pattern rewards opponents who stay in touch to the interval and back their bench. ${extras}`;
  }
  return `${teamName} are misfiring on rhythm: ${fmt(firstHalf)} points a game in the first half and ${fmt(secondHalf)} in the second, short of the tier on both. No period of the match is currently producing, which usually points upstream at platform and position rather than at finishing. ${extras}`;
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
  const peers = pool.filter(
    (r) => r.games_played > 0 && TIER_1_IDS.has(r.team_id) === TIER_1_IDS.has(teamId),
  );
  if (peers.length < 4) {
    return `The pool picture is still forming — too few sides have a meaningful sample to place ${teamName} against. Four sides with completed matches is the minimum for medians that mean anything, so the quadrant call stays blank rather than guessed.`;
  }
  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };
  const medPoss = median(peers.map((r) => r.per_game.possessionPercent ?? 0));
  const medTerr = median(peers.map((r) => r.per_game.territoryPercent ?? 0));
  const possession = agg.perGame.possessionPercent;
  const territory = agg.perGame.territoryPercent;
  const ballAbove = possession > medPoss;
  const fieldAbove = territory > medTerr;

  // Shared supporting context, appended to every quadrant verdict in
  // trim order: exact deltas to the crosshairs, pool position counts,
  // then the sample caveat.
  const others = peers.filter((r) => r.team_id !== teamId);
  const moreBall = others.filter((r) => (r.per_game.possessionPercent ?? 0) > possession).length;
  const moreField = others.filter((r) => (r.per_game.territoryPercent ?? 0) > territory).length;
  const moreBallBit =
    moreBall === 0
      ? `No other side in the pool keeps more of the ball`
      : moreBall === 1
        ? `Only one of the ${others.length} other sides keeps more of the ball`
        : `${moreBall} of the ${others.length} other sides keep more of the ball`;
  const moreFieldBit =
    moreField === 0
      ? `none holds more of the field`
      : moreField === 1
        ? `one holds more of the field`
        : `${moreField} hold more of the field`;
  const landscapeMargin = agg.perGame.pointsScored - agg.perGame.pointsConceded;
  const extras = [
    `Measured to the crosshairs, the ball share sits ${fmt(Math.abs(possession - medPoss))} points ${possession >= medPoss ? 'above' : 'below'} the tier median and the territory share ${fmt(Math.abs(territory - medTerr))} ${territory >= medTerr ? 'above' : 'below'} it.`,
    `The dot size carries the outcome: the margin runs ${landscapeMargin >= 0 ? 'plus' : 'minus'}-${fmt(Math.abs(landscapeMargin))} a game.`,
    `${moreBallBit}, and ${moreFieldBit}.`,
    `Those medians are drawn from the ${peers.length} sides in the tier with completed matches, so the crosshairs shift as the tier plays and the quadrant call is only as current as the latest round.`,
  ].join(' ');

  if (ballAbove && fieldAbove) {
    return `Set against their tier, ${teamName} have held the controllers' quadrant: ${possession.toFixed(0)}% of the ball against a median of ${medPoss.toFixed(0)}%, with the territory share also above the tier line. Owning the ball and the field at once is how matches get played on your terms. ${extras}`;
  }
  if (!ballAbove && fieldAbove) {
    return `${teamName} have lived in the kick-first quadrant: more of the field than the tier median on ${territory.toFixed(0)}% territory, taken without the ball at ${possession.toFixed(0)}% possession. Sides shaped like this play the match in the right half and ask the opponent to run out of it. ${extras}`;
  }
  if (ballAbove && !fieldAbove) {
    return `The map places ${teamName} in the keep-ball quadrant: ${possession.toFixed(0)}% of the ball, clear of the tier median, but only ${territory.toFixed(0)}% of the field. Keeping the ball in your own half moves the tackle count, not the scoreboard, so the exits decide what this shape is worth. ${extras}`;
  }
  return `Against their tier ${teamName} have sat in the starved quadrant, short of the median on both counts: ${possession.toFixed(0)}% of the ball and ${territory.toFixed(0)}% of the field. Everything downstream gets harder from there, and the route out starts with winning the kicking exchange. ${extras}`;
}

/**
 * Pool-matrix builder shared by the three correlated-pair reads (Red
 * Zone, Breakdown trade, Boot ROI) — quadrant verdict in the chart's
 * own vocabulary first, crosshair deltas and pool counts after, sample
 * caveat last (trim order per spec §5.7).
 */
function poolMatrixParts(
  teamId: string,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
  xKey: string,
  yKey: string,
): {
  peers: typeof pool;
  medX: number;
  medY: number;
  aboveX: (v: number) => number;
  aboveY: (v: number) => number;
} | null {
  // Tier-scoped peers — the matrices measure a side against ITS OWN
  // tier (owner call 2026-07-09), so the narrative medians must match
  // the chart's crosshairs.
  const peers = pool.filter(
    (r) => r.games_played > 0 && TIER_1_IDS.has(r.team_id) === TIER_1_IDS.has(teamId),
  );
  if (peers.length < 4) return null;
  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };
  const medX = median(peers.map((r) => r.per_game[xKey] ?? 0));
  const medY = median(peers.map((r) => r.per_game[yKey] ?? 0));
  const others = peers.filter((r) => r.team_id !== teamId);
  return {
    peers,
    medX,
    medY,
    aboveX: (v: number) => others.filter((r) => (r.per_game[xKey] ?? 0) > v).length,
    aboveY: (v: number) => others.filter((r) => (r.per_game[yKey] ?? 0) > v).length,
  };
}

function buildDefensiveIntegrity(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'tackleSuccessPercent', 'lineBreaksConceded');
  if (!m) {
    return `The tier picture is still forming — too few sides have completed matches to read ${teamName}'s defensive line against. Four is the minimum for medians that mean anything.`;
  }
  const completion = agg.perGame.tackleSuccessPercent;
  const breaks = agg.perGame.lineBreaksConceded;
  const conceded = agg.perGame.pointsConceded;
  const completes = completion > m.medX;
  const tight = breaks < m.medY;
  const extras = [
    `To the crosshairs, completion runs ${fmt(Math.abs(completion - m.medX))} points ${completion >= m.medX ? 'above' : 'below'} the tier median and the breaks conceded ${fmt(Math.abs(breaks - m.medY))} a game ${breaks <= m.medY ? 'inside' : 'outside'} it.`,
    `The dot size carries the bill: ${fmt(conceded)} points conceded a game.`,
    completion < 85
      ? `Completion is under the 85% line that almost always shows on the scoreboard.`
      : `Completion sits above the 85% line where defences stop leaking points.`,
    POOL_CAVEAT,
  ].join(' ');
  if (completes && tight) {
    return `${teamName} are the tier's wall: ${completion.toFixed(0)}% tackle completion and just ${fmt(breaks)} line breaks conceded a game. The tackles stick and nothing comes through — the defensive relationship working exactly as it should. ${extras}`;
  }
  if (completes && !tight) {
    return `${teamName} are out of shape: ${completion.toFixed(0)}% completion — the tackles stick — yet ${fmt(breaks)} breaks a game still come through. When completion is fine and breaks are not, the problem is structural, not effort: spacing, numbers on the edge, or the seam around the ruck. ${extras}`;
  }
  if (!completes && tight) {
    return `${teamName} are scrambling: completion of ${completion.toFixed(0)}% sits under the tier line, yet only ${fmt(breaks)} breaks a game get through. Scramble defence is surviving what the first tackle misses — admirable and unsustainable in equal measure. ${extras}`;
  }
  return `${teamName} are being broken open: ${completion.toFixed(0)}% completion and ${fmt(breaks)} line breaks conceded a game, wrong side of the tier on both. Missed tackles are the proximate cause of breaks, so the fix starts with the first collision, not the cover. ${extras}`;
}

const POOL_CAVEAT =
  'The crosshairs are tier medians from every side in the tier with completed matches, so the quadrant call moves as the tier plays.';

function buildRedZone(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'twentyTwoEntries', 'pointsPerTwentyTwoEntry');
  if (!m) {
    return `The pool picture is still forming — too few sides have completed matches to place ${teamName}'s red-zone game against. Four is the minimum for medians that mean anything.`;
  }
  const entries = agg.perGame.twentyTwoEntries;
  const yieldPer = agg.perGame.pointsPerTwentyTwoEntry;
  const often = entries > m.medX;
  const clinical = yieldPer > m.medY;
  const extras = [
    `Measured to the crosshairs, the visit count sits ${fmt(Math.abs(entries - m.medX))} ${entries >= m.medX ? 'above' : 'below'} the tier median and the yield ${fmt(Math.abs(yieldPer - m.medY))} points a visit ${yieldPer >= m.medY ? 'above' : 'below'} it.`,
    `Test par is around 2 points a visit; 3 and up is clinical.`,
    POOL_CAVEAT,
  ].join(' ');
  if (often && clinical) {
    return `${teamName} hold the relentless quadrant of the red-zone map: ${fmt(entries)} visits to the opposition 22 a game, cashed at ${fmt(yieldPer)} points each — volume and conversion at once, which is how scoreboards run away. ${extras}`;
  }
  if (!often && clinical) {
    return `${teamName} sit with the clinical sides: only ${fmt(entries)} red-zone visits a game, but ${fmt(yieldPer)} points banked per trip. They do not knock often, and they rarely leave empty-handed — the ceiling is simply getting there more. ${extras}`;
  }
  if (often && !clinical) {
    return `The map puts ${teamName} in the wasteful quadrant: ${fmt(entries)} visits a game, above the tier line, paying just ${fmt(yieldPer)} points each. The territory work is done and the points are being left behind the goal line — the most fixable shape on this chart. ${extras}`;
  }
  return `${teamName} sit in the blunt corner of the red-zone map: ${fmt(entries)} visits a game and ${fmt(yieldPer)} points a visit, short of the tier on both. Nothing downstream fixes an attack that neither arrives nor converts; the route out starts with field position. ${extras}`;
}

function buildBreakdownTrade(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'turnoversWon', 'breakdownPenaltiesConceded');
  if (!m) {
    return `The pool picture is still forming — too few sides have completed matches to price ${teamName}'s breakdown trade. Four is the minimum for medians that mean anything.`;
  }
  const steals = agg.perGame.turnoversWon;
  const pens = agg.perGame.breakdownPenaltiesConceded;
  const thieving = steals > m.medX;
  const clean = pens < m.medY;
  const extras = [
    `To the crosshairs, the steal count runs ${fmt(Math.abs(steals - m.medX))} ${steals >= m.medX ? 'above' : 'below'} the tier median and the breakdown-penalty count ${fmt(Math.abs(pens - m.medY))} ${pens <= m.medY ? 'inside' : 'outside'} it.`,
    POOL_CAVEAT,
  ].join(' ');
  if (thieving && clean) {
    return `${teamName} own the clean-thieves quadrant: ${fmt(steals)} turnovers won a game at only ${fmt(pens)} breakdown penalties conceded — ball stolen without feeding the whistle at the contest itself, the rarest trade at the breakdown. ${extras}`;
  }
  if (thieving && !clean) {
    return `${teamName} are the gamblers of the breakdown map: ${fmt(steals)} steals a game, above the tier line, bought with ${fmt(pens)} breakdown penalties. The trade pays until a referee stops letting it, so the margin between this and the clean quadrant is discipline, not appetite. ${extras}`;
  }
  if (!thieving && clean) {
    return `${teamName} sit in the passive quadrant: only ${fmt(steals)} turnovers won a game, but a tidy ${fmt(pens)} breakdown penalties conceded. The line stays out of trouble and out of the contest — pressure has to come from somewhere else in this shape. ${extras}`;
  }
  return `${teamName} are being overrun at the breakdown: ${fmt(steals)} steals a game, under the tier line, while still conceding ${fmt(pens)} breakdown penalties. Paying the whistle without taking the ball is the worst end of the bargain, and it starts at the contact area. ${extras}`;
}

function buildBootRoi(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'kickMeters', 'territoryPercent');
  if (!m) {
    return `The pool picture is still forming — too few sides have completed matches to price ${teamName}'s kicking return. Four is the minimum for medians that mean anything.`;
  }
  const boot = agg.perGame.kickMeters;
  const field = agg.perGame.territoryPercent;
  const kicksLots = boot > m.medX;
  const winsField = field > m.medY;
  const extras = [
    `To the crosshairs, the boot output runs ${fmt(Math.abs(boot - m.medX))} metres ${boot >= m.medX ? 'above' : 'below'} the tier median and the territory share ${fmt(Math.abs(field - m.medY))} points ${field >= m.medY ? 'above' : 'below'} it.`,
    POOL_CAVEAT,
  ].join(' ');
  if (kicksLots && winsField) {
    return `${teamName} sit with the field winners: ${fmt(boot)} kick metres a game converted into ${fmt(field)}% territory — the boot is buying exactly the ground it should, and the match gets played in the right half. ${extras}`;
  }
  if (!kicksLots && winsField) {
    return `${teamName} hold the carry-game quadrant of the boot map: ${fmt(field)}% territory on only ${fmt(boot)} kick metres a game. The field position is being earned ball-in-hand, which costs more collisions but keeps possession — a deliberate trade, not a failing. ${extras}`;
  }
  if (kicksLots && !winsField) {
    return `The map has ${teamName} kicking it back: ${fmt(boot)} kick metres a game, above the tier line, for just ${fmt(field)}% territory. Kicking that much without winning field means the ball is coming straight back — the chase and the contest, not the distance, are the problem. ${extras}`;
  }
  return `${teamName} are pinned on the boot map: below the tier on kick metres at ${fmt(boot)} a game and on territory at ${fmt(field)}%. Without the boot or the field the exits stay under pressure, and every attack starts long. ${extras}`;
}

/**
 * Possession matrix read — does ball share convert to points scored,
 * inside the tier; the margin (the chart's dot size) rides as context.
 */
function buildPossession(
  teamName: string,
  teamId: string,
  agg: Agg,
  pool: readonly { team_id: string; games_played: number; per_game: Record<string, number> }[],
): string {
  const m = poolMatrixParts(teamId, pool, 'possessionPercent', 'pointsScored');
  if (!m) {
    return `The tier picture is still forming — too few sides have completed matches to place ${teamName}'s use of the ball against. Four is the minimum for medians that mean anything.`;
  }
  const possession = agg.perGame.possessionPercent;
  const scored = agg.perGame.pointsScored;
  const margin = agg.perGame.pointsScored - agg.perGame.pointsConceded;
  const ballAbove = possession > m.medX;
  const scoringAbove = scored > m.medY;
  const marginPhrase = `${margin >= 0 ? 'plus' : 'minus'}-${fmt(Math.abs(margin))}`;
  const extras = [
    `To the crosshairs, the ball share runs ${fmt(Math.abs(possession - m.medX))} points ${possession >= m.medX ? 'above' : 'below'} the tier median and the scoring ${fmt(Math.abs(scored - m.medY))} a game ${scored >= m.medY ? 'above' : 'below'} it.`,
    `The dot size carries the outcome: the margin runs ${marginPhrase} a game.`,
    POOL_CAVEAT,
  ].join(' ');
  if (ballAbove && scoringAbove) {
    return `${teamName} sit with the tier's converters: ${possession.toFixed(0)}% of the ball turned into ${fmt(scored)} points a game. Share and scoring pointing the same way is exactly what this chart wants to see. ${extras}`;
  }
  if (!ballAbove && scoringAbove) {
    return `${teamName} are the tier's counter-punchers: ${fmt(scored)} points a game from only ${possession.toFixed(0)}% of the ball. Scoring without the share means the strike rate per touch is elite, and it only has to hold while the defence keeps the game close. ${extras}`;
  }
  if (ballAbove && !scoringAbove) {
    return `The map files ${teamName} under nothing to show: ${possession.toFixed(0)}% possession, above the tier line, producing just ${fmt(scored)} points a game. Holding the ball without scoring usually points at the red zone, and that is the next chart along. ${extras}`;
  }
  return `${teamName} are being shut out: below the tier on the ball at ${possession.toFixed(0)}% and on the scoreboard at ${fmt(scored)} a game. Neither share nor scoring is travelling, so the fix starts upstream with winning more and better ball. ${extras}`;
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
  // Anchor the read to the chart's y-axis: the scrum-only split.
  tail.push(
    `The chart's whistle line is the scrum's own: ${fmt(g.scrumPenaltiesConceded)} scrum penalties a game inside a total of ${fmt(g.penaltiesConceded)}.`,
  );
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
  return String(Math.round(v));
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
