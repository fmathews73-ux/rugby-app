import { useMemo } from 'react';

import type { Fixture, MatchEvent, Result, Team } from '@rugby-app/shared';

import { useFixture, useFixtureEvents, useFixtureResult, useRankingHistory, useTeams } from '@/api/hooks';
import { type TeamAggregate, useTeamAggregate } from '@/hooks/use-team-aggregate';
import { type FormOutcome, useTeamRecentForm } from '@/hooks/use-team-recent-form';

const CONTEXT_FORM_LOOKBACK = 5;
/** How far off a team's season baseline counts as "materially different"
 *  and worth calling out in the analysis. 15% either way. */
const BASELINE_VARIANCE_THRESHOLD = 0.15;

/**
 * Structured, BI-style match analysis. Every fixture is decomposed into
 * the same 8 axes the Profile radar uses (Attack, Defence, Set-piece,
 * Discipline, Kicking, Territory, Possession, Turnovers), each with a
 * per-team value, a compare-and-contrast delta, and a one-line insight.
 * On top of that a summary and a variance story name the dimensions
 * that decided (or are deciding) the match.
 */
export interface MatchAnalysis {
  /** Scoreline + high-level narrative shape. 1 paragraph. */
  summary: string;
  /** Pre-match context — coming-in form + season baseline story for
   *  both teams, framed as a broadcast opener ("Coming into this
   *  fixture..."). Sets the backdrop the current match plays out
   *  against. 1 paragraph. */
  context: string;
  /** Broadcast-style prose commentary. Weaves the deeper stats not
   *  covered by the 8 profile axes (attacking shape detail, kicking
   *  strategy, breakdown work, half-time turning-point, cards) into a
   *  paced 3-paragraph analyst read. Paragraphs are `\n\n` separated. */
  commentary: string;
  /** Variance story — biggest 2-3 gaps between the sides, named as the
   *  deciding dimensions of the match. 1 paragraph. */
  variance: string;
  /** 8 per-axis narrative reads, in the same order as the Profile
   *  radar. Each axis is a mini-section rendered under its own
   *  small-caps label — full prose with metrics woven in, no table. */
  axes: AxisAnalysis[];
  /** Closing forward-looking statement — mirrors the `context` opener.
   *  Names what each side will want to sharpen going forward, given
   *  the read of today's performance. 1 paragraph. */
  outlook: string;
  /** For live matches: the latest event minute analysis was rebuilt on.
   *  For completed: 80. */
  generatedAtMinute: number;
  status: 'live' | 'completed';
}

/** One axis read — a labeled mini-section with a full narrative paragraph
 *  that weaves the metrics into prose. No structured columns exposed to
 *  the card layer — this is a written analyst read, not a data table. */
export interface AxisAnalysis {
  key: AxisKey;
  label: string;
  /** Full prose paragraph for this axis. Weaves in the two teams'
   *  values, the delta, and any season-baseline variance in narrative
   *  form. */
  narrative: string;
}

export type AxisKey =
  | 'attack'
  | 'defence'
  | 'setPiece'
  | 'discipline'
  | 'kicking'
  | 'territory'
  | 'possession'
  | 'turnovers';

/**
 * Match analysis — structured, BI-style read of a fixture across the 8
 * profile axes.
 *
 * ─── STUB — TODO(#analysis-llm) ──────────────────────────────────────
 * This entire file is a TEMPORARY TEMPLATE. It implements the spec in
 * `docs/analysis-narrative-spec.md` client-side so we can iterate on
 * tone, structure, and card layout while the app is on synthetic data
 * (root `CLAUDE.md` §9 + PRD §5.5). At Phase 6 / cutover:
 *
 *   1. Move generation SERVER-side (Cloud Run in personal GCP project).
 *   2. LLM key in Secret Manager. Mobile client NEVER holds an
 *      inference key (mirror of the data-feed key rule).
 *   3. System prompt = the narrative spec doc verbatim.
 *   4. User prompt  = the same fixture context this hook currently
 *      assembles (Fixture, Result, season aggregates, form).
 *   5. Response contract = the `MatchAnalysis` interface below.
 *   6. Refresh cadence: event-driven + 60s debounce on live; one-shot
 *      at fulltime on completed; never on scheduled.
 *   7. Delete every `build*` / `*Narrative` / `*Paragraph` helper in
 *      this file — they become dead weight once real inference lands.
 *
 * Full cutover checklist: `docs/analysis-narrative-spec.md` §7.
 * Style rules the LLM must respect: `docs/analysis-narrative-spec.md`
 * §3–§5 (includes the AI-tell avoid-list, e.g. no em-dashes in prose,
 * no invented numbers, British English, etc.).
 *
 * Scheduled / postponed / cancelled fixtures return `null`.
 */
export function useMatchAnalysis(fixtureId: string): {
  data: MatchAnalysis | null;
  isLoading: boolean;
} {
  const fixture = useFixture(fixtureId);
  const result = useFixtureResult(fixtureId, fixture.data?.status);
  const teams = useTeams();

  // Pre-match context — same data the Preview pane surfaces. `asOfDate` is
  // the fixture's kickoff, so the aggregates reflect the SNAPSHOT AS OF
  // that moment (excluding this match itself). Recent-form gives the
  // W/L/D window into how each side arrived at kick-off.
  const homeTeamId = fixture.data?.home_team_id ?? '';
  const awayTeamId = fixture.data?.away_team_id ?? '';
  const asOfDate = fixture.data?.kickoff_utc;
  const homeAgg = useTeamAggregate(homeTeamId, asOfDate);
  const awayAgg = useTeamAggregate(awayTeamId, asOfDate);
  // Form frozen as of kickoff — without this, re-reading an old
  // fixture's "Coming in" would leak matches played AFTER it.
  const homeForm = useTeamRecentForm(homeTeamId, CONTEXT_FORM_LOOKBACK, asOfDate);
  const awayForm = useTeamRecentForm(awayTeamId, CONTEXT_FORM_LOOKBACK, asOfDate);

  // World ranking as of kickoff — the same trajectory data the Preview
  // pane charts, reduced to each side's position walking in.
  const rankingHistory = useRankingHistory();
  const { homeRank, awayRank } = useMemo(() => {
    const snaps = (rankingHistory.data ?? [])
      .filter((s) => s.source === 'world-rugby-mens' && (!asOfDate || s.snapshot_date < asOfDate))
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const latest = snaps[snaps.length - 1];
    return {
      homeRank: latest?.rows.find((r) => r.team_id === homeTeamId)?.rank ?? null,
      awayRank: latest?.rows.find((r) => r.team_id === awayTeamId)?.rank ?? null,
    };
  }, [rankingHistory.data, asOfDate, homeTeamId, awayTeamId]);

  // Event timeline — feeds the match-flow read (lead changes, decisive
  // run), the narrative counterpart of the Scoring Progression chart.
  const events = useFixtureEvents(fixtureId, fixture.data?.status);

  const isLoading =
    fixture.isLoading ||
    result.isLoading ||
    teams.isLoading ||
    homeAgg.isLoading ||
    awayAgg.isLoading;

  const data = useMemo<MatchAnalysis | null>(() => {
    if (!fixture.data || !result.data || !teams.data) return null;
    const status = fixture.data.status;
    if (status !== 'live' && status !== 'half-time' && status !== 'completed') return null;

    const home = teams.data.find((t) => t.id === fixture.data!.home_team_id);
    const away = teams.data.find((t) => t.id === fixture.data!.away_team_id);
    if (!home || !away) return null;

    return buildAnalysis(fixture.data, result.data, home, away, {
      homeAgg: homeAgg.data,
      awayAgg: awayAgg.data,
      homeForm: homeForm.outcomes,
      awayForm: awayForm.outcomes,
      homeRank,
      awayRank,
      events: events.data ?? [],
    });
  }, [
    fixture.data,
    result.data,
    teams.data,
    homeAgg.data,
    awayAgg.data,
    homeForm.outcomes,
    awayForm.outcomes,
    homeRank,
    awayRank,
    events.data,
  ]);

  return { data, isLoading };
}

/** Pre-match backdrop for both sides — form + season aggregates as of
 *  kickoff. `undefined` aggregate is OK (team has no prior completed
 *  fixtures this season). */
interface PreMatchContext {
  homeAgg: TeamAggregate | undefined;
  awayAgg: TeamAggregate | undefined;
  homeForm: readonly FormOutcome[];
  awayForm: readonly FormOutcome[];
  /** World ranking positions as of kickoff; null when unranked or the
   *  snapshot isn't loaded yet. */
  homeRank: number | null;
  awayRank: number | null;
  /** Chronological event timeline — scoring events feed the match-flow
   *  read appended to Commentary. */
  events: readonly MatchEvent[];
}

// ─── Analysis builder ───────────────────────────────────────────────────────

function buildAnalysis(
  fixture: Fixture,
  result: Result,
  home: Team,
  away: Team,
  ctx: PreMatchContext,
): MatchAnalysis {
  const isLive = fixture.status === 'live' || fixture.status === 'half-time';
  const generatedAtMinute = isLive ? liveMinuteFromKickoff(fixture) : 80;

  const axes = buildAxes(result, home, away, ctx);

  // Match-flow read (lead changes, decisive run) appends to Commentary
  // as its closing paragraph — the narrative counterpart of the
  // Scoring Progression / momentum charts on the Insights pane.
  const flow = buildMatchFlow(ctx.events, home, away, isLive);
  const commentary = buildCommentary(result, home, away, isLive, generatedAtMinute, ctx);

  return {
    summary: buildSummary(result, home, away, isLive, generatedAtMinute),
    context: buildContext(home, away, ctx),
    commentary: flow ? `${commentary}\n\n${flow}` : commentary,
    variance: buildVariance(result, home, away, isLive, ctx),
    axes,
    outlook: buildOutlook(result, home, away, isLive, ctx),
    generatedAtMinute,
    status: isLive ? 'live' : 'completed',
  };
}

/**
 * Match-flow paragraph from the scoring timeline: lead changes, when
 * the (current) leader hit the front, and the largest unanswered run.
 * Returns '' when there are no scoring events yet — the paragraph is
 * simply omitted rather than padded.
 */
function buildMatchFlow(
  events: readonly MatchEvent[],
  home: Team,
  away: Team,
  isLive: boolean,
): string {
  const scoring = events
    .filter((e) => e.points > 0 && e.team_id !== null)
    .slice()
    .sort((a, b) => a.minute + a.stoppage / 100 - (b.minute + b.stoppage / 100));
  if (scoring.length === 0) return '';

  let h = 0, a = 0;
  let leader: 'home' | 'away' | null = null;
  let leadChanges = 0;
  let leadTakenMinute = 0;
  // Largest unanswered run.
  let runTeam: string | null = null;
  let runPts = 0;
  let runStart = 0;
  let runEnd = 0;
  let bestRun = { team: null as string | null, pts: 0, start: 0, end: 0 };

  for (const e of scoring) {
    if (e.team_id === home.id) h += e.points;
    else a += e.points;

    const now: 'home' | 'away' | null = h > a ? 'home' : a > h ? 'away' : leader;
    if (now !== leader && now !== null) {
      if (leader !== null) leadChanges++;
      leadTakenMinute = e.minute;
      leader = now;
    }

    if (e.team_id === runTeam) {
      runPts += e.points;
      runEnd = e.minute;
    } else {
      runTeam = e.team_id;
      runPts = e.points;
      runStart = e.minute;
      runEnd = e.minute;
    }
    if (runPts > bestRun.pts) bestRun = { team: runTeam, pts: runPts, start: runStart, end: runEnd };
  }

  const leaderTeam = leader === 'home' ? home : leader === 'away' ? away : null;
  const parts: string[] = [];

  if (h === a) {
    parts.push(
      isLive
        ? leadChanges === 0
          ? `All square as it stands, and the lead is yet to change hands.`
          : `All square as it stands, the lead having already changed hands ${leadChanges} ${leadChanges === 1 ? 'time' : 'times'}.`
        : leadChanges === 0
          ? `Neither side could make a lead stick: level at the end, and the advantage never once swapped sides.`
          : `Neither side could make a lead stick: level at the end after ${leadChanges} ${leadChanges === 1 ? 'lead change' : 'lead changes'}.`,
    );
  } else if (leaderTeam) {
    if (leadChanges === 0) {
      parts.push(
        isLive
          ? `${leaderTeam.short_name} hit the front in the ${ordinalRank(Math.max(1, leadTakenMinute))} minute and have held it since.`
          : `${leaderTeam.short_name} hit the front in the ${ordinalRank(Math.max(1, leadTakenMinute))} minute and never surrendered the lead.`,
      );
    } else {
      parts.push(
        isLive
          ? `The lead has changed hands ${leadChanges} ${leadChanges === 1 ? 'time' : 'times'}, ${leaderTeam.short_name} holding it since the ${ordinalRank(leadTakenMinute)} minute.`
          : `The lead changed hands ${leadChanges} ${leadChanges === 1 ? 'time' : 'times'} before ${leaderTeam.short_name} took it for good in the ${ordinalRank(leadTakenMinute)} minute.`,
      );
    }
  }

  // Decisive-run callout — only when the burst is big enough to be a
  // story (10+ unanswered points).
  if (bestRun.team && bestRun.pts >= 10) {
    const runSide = bestRun.team === home.id ? home : away;
    const span =
      bestRun.start === bestRun.end
        ? `in the ${ordinalRank(Math.max(1, bestRun.start))} minute`
        : `between the ${ordinalRank(Math.max(1, bestRun.start))} and ${ordinalRank(bestRun.end)} minutes`;
    parts.push(
      `The biggest swing ${isLive ? 'so far is' : 'was'} ${bestRun.pts} unanswered points from ${runSide.short_name} ${span}.`,
    );
  }

  return parts.join(' ');
}

function liveMinuteFromKickoff(fixture: Fixture): number {
  const elapsed = Math.floor((Date.now() - new Date(fixture.kickoff_utc).getTime()) / 60000);
  return Math.min(80, Math.max(0, elapsed));
}

// ─── Pre-match context ──────────────────────────────────────────────────────

/**
 * Broadcast-style opener that establishes how each side arrived at
 * kick-off. Reads form (last-N W/L/D) + season aggregate anchors
 * (points scored, points conceded, discipline) — the same three
 * cards the Preview pane surfaces. Renders as a single dense
 * paragraph so it functions as the "cold open" to the analysis.
 */
function buildContext(home: Team, away: Team, ctx: PreMatchContext): string {
  const ranking = rankingSentence(home, away, ctx.homeRank, ctx.awayRank);
  const homeSummary = teamContextSentence(home, ctx.homeAgg, ctx.homeForm, 0);
  const awaySummary = teamContextSentence(away, ctx.awayAgg, ctx.awayForm, 1);
  const contrast = contrastSentence(home, away, ctx.homeAgg, ctx.awayAgg);
  return [ranking, homeSummary, awaySummary, contrast].filter(Boolean).join(' ');
}

/** World-ranking framing for the opener — the Preview trajectory card's
 *  headline reduced to one sentence. Skipped when either side is
 *  unranked (never invent a position). */
function rankingSentence(
  home: Team,
  away: Team,
  homeRank: number | null,
  awayRank: number | null,
): string {
  if (homeRank == null || awayRank == null) return '';
  if (homeRank === awayRank) return '';
  const gap = Math.abs(homeRank - awayRank);
  const higher = homeRank < awayRank ? home : away;
  const lower = homeRank < awayRank ? away : home;
  const hr = Math.min(homeRank, awayRank);
  const lr = Math.max(homeRank, awayRank);
  if (gap >= 8) {
    return `On the world rankings this is a mismatch on paper: ${higher.short_name} ${ordinalRank(hr)} against ${lower.short_name} down at ${ordinalRank(lr)}.`;
  }
  if (gap >= 3) {
    return `The rankings give ${higher.short_name} the edge, ${ordinalRank(hr)} in the world to ${lower.short_name}'s ${ordinalRank(lr)}.`;
  }
  return `The world rankings barely separate them, ${higher.short_name} ${ordinalRank(hr)} to ${lower.short_name}'s ${ordinalRank(lr)}.`;
}

function ordinalRank(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** One coming-in sentence per side. The `variant` flag only varies the
 *  phrasing skeleton so the home and away sentences never read as the
 *  same template run twice. */
function teamContextSentence(
  team: Team,
  agg: TeamAggregate | undefined,
  form: readonly FormOutcome[],
  variant: 0 | 1 = 0,
): string {
  const formBits: string[] = [];
  const wins = form.filter((f) => f === 'W').length;
  const losses = form.filter((f) => f === 'L').length;
  const draws = form.filter((f) => f === 'D').length;
  if (form.length > 0) {
    const record = `${wins}-${losses}${draws ? '-' + draws : ''}`;
    if (wins >= 4) formBits.push(`on a run of ${wins} wins from their last ${form.length}`);
    else if (losses >= 4) formBits.push(`carrying the weight of ${losses} defeats in their last ${form.length}`);
    else if (wins > losses) formBits.push(`in decent nick at ${record} over their last ${form.length}`);
    else if (losses > wins) formBits.push(`still hunting form at ${record} over their last ${form.length}`);
    else formBits.push(`having split their recent results ${record}`);
  }
  const aggBits: string[] = [];
  if (agg && agg.gamesPlayed > 0) {
    const pts = agg.perGame.pointsScored.toFixed(0);
    const conc = agg.perGame.pointsConceded.toFixed(0);
    aggBits.push(
      variant === 0
        ? `scoring ${pts} a game and conceding ${conc}`
        : `putting up ${pts} a game while shipping ${conc}`,
    );
  }
  if (formBits.length === 0 && aggBits.length === 0) {
    return `${team.short_name} arrive with no season record to measure this against.`;
  }
  const trailing = [...formBits, ...aggBits].join(', ');
  return variant === 0
    ? `${team.short_name} arrive ${trailing}.`
    : `${team.short_name}, for their part, come in ${trailing}.`;
}

function contrastSentence(
  home: Team,
  away: Team,
  homeAgg: TeamAggregate | undefined,
  awayAgg: TeamAggregate | undefined,
): string {
  if (!homeAgg || !awayAgg || homeAgg.gamesPlayed === 0 || awayAgg.gamesPlayed === 0) {
    return '';
  }
  const homePts = homeAgg.perGame.pointsScored;
  const awayPts = awayAgg.perGame.pointsScored;
  const homeDefPts = homeAgg.perGame.pointsConceded;
  const awayDefPts = awayAgg.perGame.pointsConceded;
  const gap = homePts - awayPts;
  const defGap = homeDefPts - awayDefPts;
  if (Math.abs(gap) >= 8) {
    const better = gap > 0 ? home : away;
    const other = gap > 0 ? away : home;
    return `On season scoring the gap is real: ${better.short_name} put up ${Math.abs(gap).toFixed(0)} more points a game, and the onus is on ${other.short_name} to make this the kind of match that number cannot win.`;
  }
  if (Math.abs(defGap) >= 8) {
    const better = defGap < 0 ? home : away;
    const other = defGap < 0 ? away : home;
    return `The defensive baselines are where they part: ${better.short_name} have shipped ${Math.abs(defGap).toFixed(0)} fewer points a game this season, and that line is the first problem ${other.short_name} have to solve.`;
  }
  return `The season baselines separate nothing, so whatever decides this will be built inside the eighty minutes rather than carried in on form.`;
}

// ─── The 8 axes ─────────────────────────────────────────────────────────────

function buildAxes(
  result: Result,
  home: Team,
  away: Team,
  ctx: PreMatchContext,
): AxisAnalysis[] {
  return [
    { key: 'attack', label: 'Attack', narrative: attackNarrative(result, home, away, ctx) },
    { key: 'defence', label: 'Defence', narrative: defenceNarrative(result, home, away, ctx) },
    { key: 'setPiece', label: 'Set-piece', narrative: setPieceNarrative(result, home, away, ctx) },
    { key: 'discipline', label: 'Discipline', narrative: disciplineNarrative(result, home, away, ctx) },
    { key: 'kicking', label: 'Kicking', narrative: kickingNarrative(result, home, away, ctx) },
    { key: 'territory', label: 'Territory', narrative: territoryNarrative(result, home, away, ctx) },
    { key: 'possession', label: 'Possession', narrative: possessionNarrative(result, home, away, ctx) },
    { key: 'turnovers', label: 'Turnovers', narrative: turnoversNarrative(result, home, away, ctx) },
  ];
}

// ─── Summary & variance ─────────────────────────────────────────────────────

function buildSummary(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  currentMinute: number,
): string {
  const scoreline = `${home.short_name} ${result.home_score}-${result.away_score} ${away.short_name}`;
  const margin = Math.abs(result.home_score - result.away_score);
  const leader =
    result.home_score > result.away_score
      ? home
      : result.away_score > result.home_score
        ? away
        : null;
  if (isLive) {
    if (!leader) return `Level at ${currentMinute}' (${scoreline}), and neither side has yet found the edge that breaks this open.`;
    if (margin >= 14) return `${leader.short_name} are pulling clear at ${currentMinute}' (${scoreline}). This is a two-score match at minimum now, and the chase gets harder by the minute.`;
    if (margin >= 7) return `${leader.short_name} lead at ${currentMinute}' (${scoreline}), and the chasing side need at least a converted score just to draw level.`;
    return `Tight at ${currentMinute}' (${scoreline}). ${leader.short_name} hold the edge, but one score flips this.`;
  }
  if (!leader) return `Full-time: ${scoreline}. Two sides who cancelled each other out, neither finding an edge it could hold long enough to win the game.`;
  if (margin >= 20) return `Full-time: ${scoreline}. ${leader.short_name} won this comprehensively, a ${margin}-point margin that settles any argument about who controlled it.`;
  if (margin >= 10) return `Full-time: ${scoreline}. ${leader.short_name} took it with room to spare, clear where Test matches are decided.`;
  return `Full-time: ${scoreline}. A tight contest settled by fine margins rather than any one-sided dimension.`;
}

// ─── Broadcast commentary ───────────────────────────────────────────────────

/**
 * 3-paragraph broadcast-style prose commentary. Weaves stats not
 * necessarily covered by the primary 8 profile axes — half-time turning
 * point, attacking shape detail (line breaks, metres, offloads), kicking
 * strategy (kicks to touch, kick metres), handling errors, sub windows —
 * into a paced analyst read.
 *
 * Structure:
 *   ¶1 Match shape and turning points (half-time story)
 *   ¶2 Attacking pattern (carries, line breaks, offloads, tries)
 *   ¶3 Kicking, set-piece and breakdown work (with a closing thought)
 */
function buildCommentary(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  currentMinute: number,
  ctx: PreMatchContext,
): string {
  const shape = shapeParagraph(result, home, away, isLive, currentMinute);
  const attack = attackParagraph(result, home, away, ctx);
  const platform = platformParagraph(result, home, away, isLive, currentMinute);
  return [shape, attack, platform].join('\n\n');
}

function shapeParagraph(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  currentMinute: number,
): string {
  const htHome = result.half_time_home;
  const htAway = result.half_time_away;
  const currentHome = result.home_score;
  const currentAway = result.away_score;
  const secondHalfHome = currentHome - htHome;
  const secondHalfAway = currentAway - htAway;
  const preHalfTime = isLive && currentMinute < 40;
  const inSecondHalf = currentMinute >= 40;

  if (preHalfTime) {
    const leader = currentHome > currentAway ? home : currentAway > currentHome ? away : null;
    const margin = Math.abs(currentHome - currentAway);
    if (!leader) return `Still inside the first forty and dead level, two game plans probing away without either finding the first crack.`;
    return `${leader.short_name} have the early running and a ${margin}-point cushion. The test between now and the break is carrying that shape through the restarts intact.`;
  }

  if (isLive && inSecondHalf) {
    const halfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
    if (halfWinner) {
      const halfMargin = Math.abs(secondHalfHome - secondHalfAway);
      return `The half-time score read ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. Since the restart the match has belonged to ${halfWinner.short_name}, ${halfMargin} points the better of the second period. Whatever was said at the interval, it landed.`;
    }
    return `Half-time read ${home.short_name} ${htHome}, ${away.short_name} ${htAway}, and the second period has kept the same shape. Neither break nor bench has shifted the balance yet.`;
  }

  // Completed
  const secondHalfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
  const finalLeader = currentHome > currentAway ? home : currentAway > currentHome ? away : null;
  if (!secondHalfWinner && !finalLeader) {
    return `A draw at the whistle: ${home.short_name} ${currentHome}, ${away.short_name} ${currentAway}. From ${htHome}-${htAway} at the break, the second forty simply repeated the first. Two sides who mirrored each other for eighty minutes.`;
  }
  if (secondHalfWinner && finalLeader && secondHalfWinner.id !== finalLeader.id) {
    return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${secondHalfWinner.short_name} won the second half (${secondHalfWinner.id === home.id ? secondHalfHome : secondHalfAway} points to ${secondHalfWinner.id === home.id ? secondHalfAway : secondHalfHome}) and made the closing stretch uncomfortable, but the cushion ${finalLeader.short_name} built before the interval proved the match's real currency.`;
  }
  return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${finalLeader ? `${finalLeader.short_name} pushed on after the interval; the second forty is where this one was actually won.` : `The sides traded blows to the end without either landing the decisive one.`}`;
}

function attackParagraph(result: Result, home: Team, away: Team, ctx: PreMatchContext): string {
  const parts: string[] = [];

  // Line breaks + metres — attacking penetration. Both anchored against
  // the season baseline where available so the reader can judge whether
  // "6 line breaks" is a hot day or a quiet one for this side.
  const homeLB = result.home_line_breaks ?? 0;
  const awayLB = result.away_line_breaks ?? 0;
  const homeM = result.home_meters ?? 0;
  const awayM = result.away_meters ?? 0;
  const homeLBBase = ctx.homeAgg?.perGame.lineBreaks;
  const awayLBBase = ctx.awayAgg?.perGame.lineBreaks;
  if (Math.abs(homeLB - awayLB) >= 2) {
    const better = homeLB > awayLB ? home : away;
    const betterBase = better.id === home.id ? homeLBBase : awayLBBase;
    const betterCount = Math.max(homeLB, awayLB);
    if (betterBase && betterCount > betterBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
      parts.push(
        `${better.short_name} keep finding the softer edges, ${betterCount} line breaks to ${Math.min(homeLB, awayLB)}. That is comfortably above the ${betterBase.toFixed(1)} they average in a match: the cutting edge is sharper than usual today.`,
      );
    } else {
      parts.push(
        `${better.short_name} keep finding the softer edges. ${betterCount} line breaks to ${Math.min(homeLB, awayLB)} says one attacking system is asking questions the other cannot.`,
      );
    }
  } else if (homeLB + awayLB >= 6) {
    parts.push(
      `Line breaks are flowing at both ends (${homeLB}-${awayLB}). This is an open contest, not an arm-wrestle, and both defences know it.`,
    );
  }

  if (Math.abs(homeM - awayM) >= 100) {
    const better = homeM > awayM ? home : away;
    parts.push(
      `${better.short_name} have won the carrying contest emphatically, ${Math.round(Math.max(homeM, awayM))} metres to ${Math.round(Math.min(homeM, awayM))}, and every one of those metres is a defender going backwards.`,
    );
  }

  // Offloads — attacking flair
  const homeOff = result.home_offloads ?? 0;
  const awayOff = result.away_offloads ?? 0;
  if (Math.max(homeOff, awayOff) >= 8) {
    const better = homeOff > awayOff ? home : away;
    parts.push(
      `${better.short_name}'s ${Math.max(homeOff, awayOff)} offloads tell you the intent: keep the ball alive, refuse to let the collision end the phase.`,
    );
  }

  // Tries + conversions — finishing
  const totalTries = result.home_tries + result.away_tries;
  const homeConv = result.home_conversions ?? 0;
  const awayConv = result.away_conversions ?? 0;
  if (totalTries > 0) {
    parts.push(
      `The finishing ledger reads ${result.home_tries}-${result.away_tries} in tries, ${homeConv}-${awayConv} off the tee, and the boot has done its share of the work.`,
    );
  }

  // Gainline dominance — an 8pp gap in gainline success is a front-foot
  // story worth naming; post-contact metres qualify it.
  const homeGain = result.home_gainline_success_percent ?? 0;
  const awayGain = result.away_gainline_success_percent ?? 0;
  if (Math.abs(homeGain - awayGain) >= 8) {
    const front = homeGain > awayGain ? home : away;
    const pcm = front.id === home.id ? result.home_post_contact_metres : result.away_post_contact_metres;
    parts.push(
      `The collisions belong to ${front.short_name}, over the gainline on ${Math.max(homeGain, awayGain)}% of carries against ${Math.min(homeGain, awayGain)}%.${pcm ? ` Another ${pcm} metres have come after contact.` : ''} Front-foot ball changes everything downstream.`,
    );
  }

  // Handling — attacking execution
  const homeErr = result.home_handling_errors ?? 0;
  const awayErr = result.away_handling_errors ?? 0;
  if (Math.max(homeErr, awayErr) >= 12) {
    const worse = homeErr > awayErr ? home : away;
    parts.push(
      `${worse.short_name}'s handling has been the flaw, ${Math.max(homeErr, awayErr)} errors in the match, each one an attacking platform given away.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      `The two attacks mirror each other, line breaks ${homeLB}-${awayLB} and tries ${result.home_tries}-${result.away_tries}, and neither back line has found a question the other cannot answer.`,
    );
  }

  return parts.join(' ');
}

function platformParagraph(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  currentMinute: number,
): string {
  const parts: string[] = [];

  // Kicking strategy
  const homeKIP = result.home_kicks_in_play ?? 0;
  const awayKIP = result.away_kicks_in_play ?? 0;
  const homeKT = result.home_kicks_to_touch ?? 0;
  const awayKT = result.away_kicks_to_touch ?? 0;
  const homeKM = result.home_kick_meters ?? 0;
  const awayKM = result.away_kick_meters ?? 0;
  if (Math.abs(homeKIP - awayKIP) >= 6) {
    const kicker = homeKIP > awayKIP ? home : away;
    parts.push(
      `${kicker.short_name} have played the more kick-shaped game, ${Math.max(homeKIP, awayKIP)} kicks in play to ${Math.min(homeKIP, awayKIP)}: territory first, and willing to give the ball back to get it.`,
    );
  }
  if (homeKM + awayKM > 0 && Math.abs(homeKM - awayKM) >= 200) {
    const better = homeKM > awayKM ? home : away;
    parts.push(
      `${better.short_name}'s boot has won the long-range exchange, ${Math.round(Math.max(homeKM, awayKM))} kicked metres to ${Math.round(Math.min(homeKM, awayKM))}, and with it the right to play in the opposition half.`,
    );
  } else if (homeKT + awayKT >= 20) {
    parts.push(
      `Kicks to touch have stacked up (${homeKT}-${awayKT}). Both sides want this settled off lineout launches, not broken field.`,
    );
  }

  // Set-piece drops
  const homeScrumLost = result.home_scrums_lost ?? 0;
  const awayScrumLost = result.away_scrums_lost ?? 0;
  const homeLineoutLost = result.home_lineouts_lost ?? 0;
  const awayLineoutLost = result.away_lineouts_lost ?? 0;
  if (Math.max(homeScrumLost, awayScrumLost) >= 2 || Math.max(homeLineoutLost, awayLineoutLost) >= 3) {
    const worseSet = homeScrumLost + homeLineoutLost > awayScrumLost + awayLineoutLost ? home : away;
    parts.push(
      `${worseSet.short_name}'s set-piece has wobbled on its own ball, and possession given up at the source is the hardest kind to win back.`,
    );
  }

  // Turnovers / breakdown
  const homeTOW = result.home_turnovers_won ?? 0;
  const awayTOW = result.away_turnovers_won ?? 0;
  if (Math.abs(homeTOW - awayTOW) >= 4) {
    const jackaller = homeTOW > awayTOW ? home : away;
    parts.push(
      `At the contact area ${jackaller.short_name} have picked ${Math.max(homeTOW, awayTOW)} turnovers to ${Math.min(homeTOW, awayTOW)}, and each one has flipped the field just as the opposition were building.`,
    );
  }

  // Ruck retention + quick-ball tempo. Retention gaps of 4pp or a side
  // dipping under 88% are real breakdown stories; a 10pp quick-ball gap
  // is the tempo read.
  const homeRuckPct = ruckRetention(result.home_rucks_won, result.home_rucks_lost);
  const awayRuckPct = ruckRetention(result.away_rucks_won, result.away_rucks_lost);
  if (homeRuckPct !== null && awayRuckPct !== null) {
    if (Math.min(homeRuckPct, awayRuckPct) < 88 || Math.abs(homeRuckPct - awayRuckPct) >= 4) {
      const cleaner = homeRuckPct >= awayRuckPct ? home : away;
      const messier = cleaner.id === home.id ? away : home;
      parts.push(
        `Ruck ball tells its own story, ${cleaner.short_name} recycling at ${Math.round(Math.max(homeRuckPct, awayRuckPct))}% to ${Math.round(Math.min(homeRuckPct, awayRuckPct))}%, and ${messier.short_name}'s loose ball at the breakdown keeps handing back cheap possession.`,
      );
    }
  }
  const homeQuick = result.home_ruck_speed_0_3s_percent ?? 0;
  const awayQuick = result.away_ruck_speed_0_3s_percent ?? 0;
  if (Math.abs(homeQuick - awayQuick) >= 10) {
    const faster = homeQuick > awayQuick ? home : away;
    parts.push(
      `Tempo belongs to ${faster.short_name}: ${Math.max(homeQuick, awayQuick)}% of their rucks produce ball inside three seconds, against ${Math.min(homeQuick, awayQuick)}%, which is why their attack keeps meeting a defence that has not reset.`,
    );
  }

  // Discipline / cards
  const homeCards = (result.home_yellow_cards ?? 0) + (result.home_red_cards ?? 0);
  const awayCards = (result.away_yellow_cards ?? 0) + (result.away_red_cards ?? 0);
  if (homeCards + awayCards > 0) {
    const carded = homeCards > awayCards ? home : awayCards > homeCards ? away : null;
    if (carded) {
      parts.push(
        `${carded.short_name} have shipped ${homeCards > awayCards ? homeCards : awayCards} card${(homeCards > awayCards ? homeCards : awayCards) === 1 ? '' : 's'}, and a game plan does not survive minutes a man short intact.`,
      );
    } else {
      parts.push('Cards have gone both ways, adding a stop-start edge to the whole contest.');
    }
  }

  // Closing thought
  if (isLive) {
    const remaining = Math.max(0, 80 - currentMinute);
    parts.push(
      `${remaining} minutes remain, time enough for a bench to swing the platform battle the other way.`,
    );
  } else {
    parts.push(
      'The platform work, the kicking exchange, the set-piece and the breakdown, is where the final scoreline was quietly built.',
    );
  }

  if (parts.length === 0) {
    return 'The platform battle finished all square: solid set-piece on both sides, an even breakdown, kicking exchanges cancelling out. No hidden leverage in this one.';
  }

  return parts.join(' ');
}

/** Signed axis gap used for the variance story — positive = home ahead. */
interface AxisGap {
  key: AxisKey;
  label: string;
  signedGap: number;
  advantage: 'home' | 'away';
}

function buildVariance(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  _ctx: PreMatchContext,
): string {
  const gaps = computeAxisGaps(result);
  const decisive = gaps.filter((g) => Math.abs(g.signedGap) >= gapThreshold(g.key));
  if (decisive.length === 0) {
    return isLive
      ? `Near-mirror numbers so far, with no dimension yet opening a decisive gap between ${home.short_name} and ${away.short_name}.`
      : `Near-mirror numbers throughout: no single dimension separated ${home.short_name} and ${away.short_name} decisively, and the match was settled in the margins.`;
  }

  const homeWinners = decisive.filter((g) => g.advantage === 'home');
  const awayWinners = decisive.filter((g) => g.advantage === 'away');
  const rank = (a: AxisGap, b: AxisGap) => Math.abs(b.signedGap) - Math.abs(a.signedGap);
  const topHome = homeWinners.slice().sort(rank).slice(0, 2);
  const topAway = awayWinners.slice().sort(rank).slice(0, 2);

  const parts: string[] = [];
  if (topHome.length) parts.push(`${home.short_name} ${isLive ? 'ahead' : 'came out ahead'} on ${listGapLabels(topHome)}`);
  if (topAway.length) parts.push(`${away.short_name} ${isLive ? 'ahead' : 'ended up ahead'} on ${listGapLabels(topAway)}`);
  return isLive
    ? `The gaps that matter are opening up: ${parts.join('; ')}. Those are the dimensions writing the scoreboard.`
    : `The gaps that mattered are plain: ${parts.join('; ')}. Those were the dimensions that wrote the scoreboard.`;
}

/** Threshold above which an axis gap is worth naming as decisive. Tight
 *  numeric axes want smaller thresholds than percentage axes. */
function gapThreshold(key: AxisKey): number {
  switch (key) {
    case 'attack':
    case 'defence':
      return 3;
    case 'discipline':
    case 'turnovers':
      return 2;
    case 'kicking':
      return 5;
    case 'setPiece':
    case 'territory':
    case 'possession':
      return 6;
    default:
      return 3;
  }
}

function computeAxisGaps(result: Result): AxisGap[] {
  const homeSet = combinedSetPiecePercent(
    result.home_scrums_won,
    result.home_scrums_lost,
    result.home_lineouts_won,
    result.home_lineouts_lost,
  );
  const awaySet = combinedSetPiecePercent(
    result.away_scrums_won,
    result.away_scrums_lost,
    result.away_lineouts_won,
    result.away_lineouts_lost,
  );
  const homeMPerKick = result.home_kicks_in_play > 0 ? result.home_kick_meters / result.home_kicks_in_play : 0;
  const awayMPerKick = result.away_kicks_in_play > 0 ? result.away_kick_meters / result.away_kicks_in_play : 0;

  const raw: { key: AxisKey; label: string; homeVal: number; awayVal: number; higherIsBetter: boolean }[] = [
    { key: 'attack', label: 'Attack', homeVal: result.home_score, awayVal: result.away_score, higherIsBetter: true },
    { key: 'defence', label: 'Defence', homeVal: result.away_score, awayVal: result.home_score, higherIsBetter: false },
    { key: 'setPiece', label: 'Set-piece', homeVal: homeSet, awayVal: awaySet, higherIsBetter: true },
    { key: 'discipline', label: 'Discipline', homeVal: result.home_penalties_conceded ?? 0, awayVal: result.away_penalties_conceded ?? 0, higherIsBetter: false },
    { key: 'kicking', label: 'Kicking', homeVal: homeMPerKick, awayVal: awayMPerKick, higherIsBetter: true },
    { key: 'territory', label: 'Territory', homeVal: result.home_territory_percent, awayVal: result.away_territory_percent, higherIsBetter: true },
    { key: 'possession', label: 'Possession', homeVal: result.home_possession_percent, awayVal: result.away_possession_percent, higherIsBetter: true },
    { key: 'turnovers', label: 'Turnovers', homeVal: result.home_turnovers_won, awayVal: result.away_turnovers_won, higherIsBetter: true },
  ];

  return raw.map((r) => {
    const rawDelta = r.homeVal - r.awayVal;
    // For "higherIsBetter=false" axes (Defence and Discipline are
    // inverted, but by the time we get here Defence's home/away vals are
    // already swapped so it reads higher-is-better), pass through.
    const homeAhead = r.higherIsBetter ? rawDelta > 0 : rawDelta < 0;
    return {
      key: r.key,
      label: r.label,
      signedGap: Math.abs(rawDelta),
      advantage: homeAhead ? ('home' as const) : ('away' as const),
    };
  });
}

function listGapLabels(gaps: readonly AxisGap[]): string {
  if (gaps.length === 1) return gaps[0]!.label;
  return gaps.map((g) => g.label).join(' and ');
}

// ─── Per-axis narrative builders ────────────────────────────────────────────
//
// Each function produces a 2-3 sentence woven paragraph for its axis.
// Metrics are integrated into prose rather than tabulated. Where a side's
// performance is materially off their season baseline, a variance callout
// is woven into the paragraph. Reads as an analyst's spoken read of the
// dimension rather than a table cell.

function attackNarrative(result: Result, home: Team, away: Team, ctx: PreMatchContext): string {
  const homeS = result.home_score;
  const awayS = result.away_score;
  const homeT = result.home_tries;
  const awayT = result.away_tries;
  const homeBase = ctx.homeAgg?.perGame.pointsScored;
  const awayBase = ctx.awayAgg?.perGame.pointsScored;

  const openLine = homeS > awayS
    ? `${home.short_name} have been the sharper attacking side, ${homeS} points to ${away.short_name}'s ${awayS} at the business end.`
    : awayS > homeS
      ? `${away.short_name} have been the sharper attacking side, ${awayS} points to ${home.short_name}'s ${homeS} at the business end.`
      : `Two attacks, identical output: ${homeS} points apiece.`;

  const tryLine = Math.abs(homeT - awayT) >= 2
    ? ` It is the five-pointers doing the separating: tries have run ${homeT}-${awayT}, and ${homeT > awayT ? home.short_name : away.short_name}'s strike play is the difference.`
    : homeT + awayT === 0
      ? ' Neither side has crossed the whitewash, so the boot has done all the scoring.'
      : ` With tries level at ${homeT}-${awayT}, any extra yield has come off the tee and the set-piece rather than from strike play.`;

  const varianceLine = attackVarianceReference(homeS, awayS, homeBase, awayBase, home, away);

  return `${openLine}${tryLine}${varianceLine}`;
}

function attackVarianceReference(
  homeS: number,
  awayS: number,
  homeBase: number | undefined,
  awayBase: number | undefined,
  home: Team,
  away: Team,
): string {
  if (homeBase && homeBase > 0 && homeS > homeBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${home.short_name} are running well clear of the ${homeBase.toFixed(0)} a game they normally manage; this is an attacking shift above their own standard.`;
  }
  if (awayBase && awayBase > 0 && awayS > awayBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} are running well clear of the ${awayBase.toFixed(0)} a game they normally manage; this is an attacking shift above their own standard.`;
  }
  if (homeBase && homeBase > 0 && homeS < homeBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${home.short_name} have fallen well short of their ${homeBase.toFixed(0)}-a-game standard, and that shortfall frames everything else in their performance.`;
  }
  if (awayBase && awayBase > 0 && awayS < awayBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} have fallen well short of their ${awayBase.toFixed(0)}-a-game standard, and that shortfall frames everything else in their performance.`;
  }
  return '';
}

function defenceNarrative(result: Result, home: Team, away: Team, ctx: PreMatchContext): string {
  // Defensive value = points the OPPOSING side scored on you.
  const homeConceded = result.away_score;
  const awayConceded = result.home_score;
  const homeTackle = result.home_tackle_success_percent ?? 0;
  const awayTackle = result.away_tackle_success_percent ?? 0;
  const homeBase = ctx.homeAgg?.perGame.pointsConceded;
  const awayBase = ctx.awayAgg?.perGame.pointsConceded;

  const openLine = homeConceded < awayConceded
    ? `The harder line to break has been ${home.short_name}'s, ${homeConceded} conceded against ${awayConceded} at the other end.`
    : awayConceded < homeConceded
      ? `The harder line to break has been ${away.short_name}'s, ${awayConceded} conceded against ${homeConceded} at the other end.`
      : `Neither defence has given the other an inch of advantage: ${homeConceded} conceded apiece.`;

  const tackleLine = Math.abs(homeTackle - awayTackle) >= 5
    ? ` Tackle completion explains part of it, ${Math.round(Math.max(homeTackle, awayTackle))}% to ${Math.round(Math.min(homeTackle, awayTackle))}%, with line integrity doing the real work.`
    : ` With tackle completion near-level (${Math.round(homeTackle)}% and ${Math.round(awayTackle)}%), any gap in concessions traces to field position rather than missed hits.`;

  const varianceLine = defenceVarianceReference(homeConceded, awayConceded, homeBase, awayBase, home, away);

  return `${openLine}${tackleLine}${varianceLine}`;
}

function defenceVarianceReference(
  homeConceded: number,
  awayConceded: number,
  homeBase: number | undefined,
  awayBase: number | undefined,
  home: Team,
  away: Team,
): string {
  if (homeBase && homeConceded > homeBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${home.short_name} are leaking beyond the ${homeBase.toFixed(0)} a game they usually hold opponents to; this is not their normal shape.`;
  }
  if (awayBase && awayConceded > awayBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} are leaking beyond the ${awayBase.toFixed(0)} a game they usually hold opponents to, and the system is under real strain.`;
  }
  return '';
}

function setPieceNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const homeScrumLost = result.home_scrums_lost ?? 0;
  const awayScrumLost = result.away_scrums_lost ?? 0;
  const homeLineoutLost = result.home_lineouts_lost ?? 0;
  const awayLineoutLost = result.away_lineouts_lost ?? 0;

  // Maul read appended when either pack has made the drive a weapon
  // (8+ mauls won) or a liability (2+ lost).
  const maulSentence = maulRead(result, home, away);

  if (Math.max(homeScrumLost, awayScrumLost) >= 2) {
    const worse = homeScrumLost > awayScrumLost ? home : away;
    return `The scrum is where the pressure is telling. ${worse.short_name} keep losing their own feed, and every lost engagement walks the opposing pack up-field for free.${maulSentence}`;
  }
  if (Math.max(homeLineoutLost, awayLineoutLost) >= 3) {
    const worse = homeLineoutLost > awayLineoutLost ? home : away;
    return `The leak is at the lineout. ${worse.short_name}'s throw-and-jump timing has not held, each misfire hands attacking territory straight back, and their launch platform has to come from somewhere else.${maulSentence}`;
  }
  return `Both packs have looked after their own ball, and the set-piece has cancelled out. With no easy possession off the platform, the points have had to be built in open play.${maulSentence}`;
}

function maulRead(result: Result, home: Team, away: Team): string {
  const homeMauls = result.home_mauls_won ?? 0;
  const awayMauls = result.away_mauls_won ?? 0;
  const homeMaulsLost = result.home_mauls_lost ?? 0;
  const awayMaulsLost = result.away_mauls_lost ?? 0;

  if (Math.max(homeMauls, awayMauls) >= 8 && Math.abs(homeMauls - awayMauls) >= 3) {
    const driver = homeMauls > awayMauls ? home : away;
    return ` ${driver.short_name}'s driving maul has been a weapon in its own right (${Math.max(homeMauls, awayMauls)} won), pulling in defenders and opening space out wide.`;
  }
  if (Math.max(homeMaulsLost, awayMaulsLost) >= 2) {
    const worse = homeMaulsLost > awayMaulsLost ? home : away;
    return ` ${worse.short_name} have also seen their maul held up more than once, prime lineout platforms wasted.`;
  }
  return '';
}

function disciplineNarrative(result: Result, home: Team, away: Team, ctx: PreMatchContext): string {
  const homeCards = (result.home_yellow_cards ?? 0) + (result.home_red_cards ?? 0);
  const awayCards = (result.away_yellow_cards ?? 0) + (result.away_red_cards ?? 0);
  const homePens = result.home_penalties_conceded ?? 0;
  const awayPens = result.away_penalties_conceded ?? 0;

  if (homeCards + awayCards > 0) {
    const carded = homeCards > awayCards ? home : awayCards > homeCards ? away : null;
    if (carded) {
      return `${carded.short_name} have spent part of this match a man down, and cards shift the whole territorial equation. ${homeCards > awayCards ? away.short_name : home.short_name} have had extra-man windows to attack, and defending them is where ${carded.short_name}'s energy has gone.`;
    }
    return `Cards on both sides have left each defence covering fourteen-man phases, and the contest has carried a scrappy disciplinary edge because of it. Neither side has been decisively punished.`;
  }
  if (Math.abs(homePens - awayPens) >= 3) {
    const worse = homePens > awayPens ? home : away;
    const worseCount = Math.max(homePens, awayPens);
    const worseBase =
      worse.id === home.id ? ctx.homeAgg?.perGame.penaltiesConceded : ctx.awayAgg?.perGame.penaltiesConceded;
    const varianceBit =
      worseBase && worseCount > worseBase * (1 + BASELINE_VARIANCE_THRESHOLD)
        ? ` It is also well beyond their ${worseBase.toFixed(0)}-a-game season norm, so this is an off-day by their own standards, not a habit.`
        : '';
    return `The penalty count runs against ${worse.short_name}, and every whistle is field position or points handed over. It is the quiet tax on everything else they are trying to do.${varianceBit}${penaltyCauseRead(result, worse, worse.id === home.id)}`;
  }
  return `Discipline has held on both sides. With the whistle largely staying in the referee's pocket, neither side is being gifted shots at goal, and the contest is being settled by play rather than penalty.`;
}

/** Names the dominant penalty cause when one bucket carries half or
 *  more of the offending side's count — the "where the leak is" read. */
function penaltyCauseRead(result: Result, worse: Team, worseIsHome: boolean): string {
  const total = worseIsHome ? result.home_penalties_conceded : result.away_penalties_conceded;
  if (!total) return '';
  const causes: [string, number][] = [
    ['the scrum', worseIsHome ? result.home_scrum_penalties_conceded : result.away_scrum_penalties_conceded],
    ['the breakdown', worseIsHome ? result.home_breakdown_penalties_conceded : result.away_breakdown_penalties_conceded],
    ['offside', worseIsHome ? result.home_offside_penalties_conceded : result.away_offside_penalties_conceded],
  ];
  const [label, count] = causes.sort((x, y) => y[1] - x[1])[0]!;
  if (count / total < 0.5) return '';
  return ` The leak concentrates at ${label}, ${count} of the ${total}, which at least gives the coaches one specific problem to fix rather than a general talking-to.`;
}

function kickingNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const homeM = result.home_kicks_in_play > 0 ? result.home_kick_meters / result.home_kicks_in_play : 0;
  const awayM = result.away_kicks_in_play > 0 ? result.away_kick_meters / result.away_kicks_in_play : 0;
  const homeKIP = result.home_kicks_in_play ?? 0;
  const awayKIP = result.away_kicks_in_play ?? 0;

  // 50/22s are rare enough that any successful one is worth naming.
  const fiftyTwentyTwo = fiftyTwentyTwoRead(result, home, away);

  if (Math.abs(homeM - awayM) >= 8) {
    const better = homeM > awayM ? home : away;
    return `The territorial kicking duel has gone ${better.short_name}'s way. More distance per kick means the exits keep landing deeper, and the game keeps being played where they want it. A quiet edge, but a decisive one.${fiftyTwentyTwo}`;
  }
  if (Math.abs(homeKIP - awayKIP) >= 6) {
    const kicker = homeKIP > awayKIP ? home : away;
    return `${kicker.short_name} have made the boot their strategy, kicking far more often and trusting field position over phase count. That is a choice, not a shortage of ideas.${fiftyTwentyTwo}`;
  }
  return `Kicking exchanges have cancelled out, both boots finding similar lengths and neither back three winning the air decisively. The territorial contest is being fought elsewhere.${fiftyTwentyTwo}`;
}

function fiftyTwentyTwoRead(result: Result, home: Team, away: Team): string {
  const h = result.home_fifty_twenty_twos ?? 0;
  const a = result.away_fifty_twenty_twos ?? 0;
  if (h === 0 && a === 0) return '';
  const kicker = h >= a ? home : away;
  const count = Math.max(h, a);
  return ` ${kicker.short_name} have also landed ${count === 1 ? 'a 50/22' : `${count} 50/22s`}, the kick that turns a defensive position into an attacking lineout in one swing.`;
}

function territoryNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_territory_percent - result.away_territory_percent;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    const trailing = delta > 0 ? away : home;
    return `Territory has swung heavily ${dominant.short_name}'s way. That leaves ${trailing.short_name} defending from deep for long stretches, and sustained pressure of that kind eventually cracks most lines. Whether it converts is the open question.`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `The field-position battle is tilting towards ${dominant.short_name}, less an avalanche than a slow squeeze up-field. The pressure is building rather than exploding.`;
  }
  return `Neither side has managed to pin the other back; the game has lived in the middle third, and even geography like that suits the defences.`;
}

function possessionNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_possession_percent - result.away_possession_percent;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    return `Access to the ball is not ${dominant.short_name}'s problem; they have monopolised it. What that heavy lean demands is conversion, and the phase count has to start paying in points before the door closes on it.`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `${dominant.short_name} are shading the ball and setting the tempo, asking the opposition to make more tackles than they would like. A steady lean, not a landslide.`;
  }
  return `Possession has split near-even, both sides backing their carry-and-recycle game, so what separates them is efficiency rather than volume of touches.`;
}

function turnoversNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_turnovers_won - result.away_turnovers_won;
  const total = result.home_turnovers_won + result.away_turnovers_won;
  if (Math.abs(delta) >= 4) {
    const better = delta > 0 ? home : away;
    return `The breakdown contest has a clear winner. ${better.short_name} keep coming away with opposition ball, and each steal is a possession swing plus a counter-attack the other side has to defend. That double cost is why turnovers hurt twice.`;
  }
  if (total >= 15) {
    return `Turnovers are flying at both ends, ball retention at a premium and the breakdown a fight every phase. Chaos of that kind usually rewards the sharper counter-attack.`;
  }
  return `Little to choose at the breakdown, with neither side winning the contact area decisively; this has flowed as a phase-count contest rather than a broken-field one.`;
}

// ─── Closing outlook ────────────────────────────────────────────────────────

/**
 * Forward-looking closing statement — mirrors the `context` opener with
 * an actionable read on what each side will want to sharpen. Reads the
 * biggest axis gaps AND any material variances vs season baseline, then
 * frames them constructively (weak points as growth areas).
 */
function buildOutlook(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  ctx: PreMatchContext,
): string {
  const homeArea = weakestAreaFor(result, home, away, 'home', ctx);
  const awayArea = weakestAreaFor(result, home, away, 'away', ctx);
  const framing = isLive ? 'Going forward from here' : 'Going forward';
  const parts: string[] = [];
  if (homeArea) parts.push(`${home.short_name} will want to sharpen ${homeArea}`);
  if (awayArea) parts.push(`${away.short_name} will need to work on ${awayArea}`);
  if (parts.length === 0) {
    return `${framing}, the read is broadly balanced: no single dimension stands out as the pressing weakness, and the next steps live in marginal gains.`;
  }
  return `${framing}, ${parts.join('; ')}. Those are the lines the review will open with.`;
}

/**
 * Pick the axis or aspect most in need of improvement for the given
 * side. Priority is: card-driven concession > baseline variance on
 * defence > scrum/lineout leak > penalty count > territory/possession
 * mismatch > line-break shortfall.
 */
function weakestAreaFor(
  result: Result,
  home: Team,
  away: Team,
  side: 'home' | 'away',
  ctx: PreMatchContext,
): string | null {
  const oppTeam = side === 'home' ? away : home;

  const cards =
    side === 'home'
      ? (result.home_yellow_cards ?? 0) + (result.home_red_cards ?? 0)
      : (result.away_yellow_cards ?? 0) + (result.away_red_cards ?? 0);
  if (cards > 0) {
    return `discipline in the tackle contest (playing a man short has been costly against ${oppTeam.short_name})`;
  }

  const conceded = side === 'home' ? result.away_score : result.home_score;
  const concededBase =
    side === 'home' ? ctx.homeAgg?.perGame.pointsConceded : ctx.awayAgg?.perGame.pointsConceded;
  if (concededBase && conceded > concededBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return `their defensive line (${conceded} shipped against a season norm of ${concededBase.toFixed(0)} a game)`;
  }

  const scrumLost =
    side === 'home' ? (result.home_scrums_lost ?? 0) : (result.away_scrums_lost ?? 0);
  const lineoutLost =
    side === 'home' ? (result.home_lineouts_lost ?? 0) : (result.away_lineouts_lost ?? 0);
  if (scrumLost >= 2 || lineoutLost >= 3) {
    return `their set-piece platform (own ball lost at the ${scrumLost >= 2 ? 'scrum' : 'lineout'} is the first item on the review)`;
  }

  const pens =
    side === 'home' ? (result.home_penalties_conceded ?? 0) : (result.away_penalties_conceded ?? 0);
  const oppPens =
    side === 'home' ? (result.away_penalties_conceded ?? 0) : (result.home_penalties_conceded ?? 0);
  if (pens >= oppPens + 3) {
    return `their penalty count (${pens} conceded is field position handed over for free)`;
  }

  const scored = side === 'home' ? result.home_score : result.away_score;
  const scoredBase =
    side === 'home' ? ctx.homeAgg?.perGame.pointsScored : ctx.awayAgg?.perGame.pointsScored;
  if (scoredBase && scored < scoredBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return `their attacking conversion (${scored} points against a ${scoredBase.toFixed(0)}-a-game season line)`;
  }

  return null;
}

// ─── Small helpers ──────────────────────────────────────────────────────────

/** Ruck retention percentage, or null when a side somehow has no
 *  recorded rucks (defensive-only live snapshot). */
function ruckRetention(won: number | undefined, lost: number | undefined): number | null {
  const w = won ?? 0;
  const l = lost ?? 0;
  if (w + l === 0) return null;
  return (w / (w + l)) * 100;
}

/** Combined scrum + lineout success percentage — mirrors the radar's
 *  set-piece axis. Falls back to 0 when a team has no set-pieces. */
function combinedSetPiecePercent(
  scrumsWon: number,
  scrumsLost: number,
  lineoutsWon: number,
  lineoutsLost: number,
): number {
  const scrumTotal = scrumsWon + scrumsLost;
  const lineoutTotal = lineoutsWon + lineoutsLost;
  const scrumPct = scrumTotal > 0 ? (scrumsWon / scrumTotal) * 100 : 0;
  const lineoutPct = lineoutTotal > 0 ? (lineoutsWon / lineoutTotal) * 100 : 0;
  if (scrumTotal === 0 && lineoutTotal === 0) return 0;
  if (scrumTotal === 0) return lineoutPct;
  if (lineoutTotal === 0) return scrumPct;
  return (scrumPct + lineoutPct) / 2;
}
