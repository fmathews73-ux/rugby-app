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
/** Signed, threshold-normalised in-match axis gap for chart surfaces
 *  (the Match Gaps card). norm > 0 = home ahead; |norm| >= 1 crosses
 *  the "decisive" threshold buildVariance names axes at. */
export interface MatchGapView {
  key: AxisKey;
  label: string;
  norm: number;
}

export interface MatchAnalysis {
  /** Scoreline + high-level narrative shape. 1 paragraph. */
  summary: string;
  /** "Momentum" — the initiative/shape read (was commentary ¶1). */
  momentum: string;
  /** Attack-pattern paragraph — opens the "Attack & Defence" section
   *  (was commentary ¶2). */
  attackPattern: string;
  /** Platform paragraph — opens the "Set Piece & Discipline" section
   *  (was commentary ¶3). */
  platform: string;
  /** "Scoring Progression" — the scoreboard-flow read: lead changes,
   *  taken-for-good minute, decisive runs (was the flow paragraph). */
  progression: string;
  /** "Match Gaps" — biggest 2-3 gaps between the sides, named as the
   *  deciding dimensions of the match. 1 paragraph. */
  variance: string;
  /** 8 per-axis narrative reads, in the same order as the Profile
   *  radar. Each axis is a mini-section rendered under its own
   *  small-caps label — full prose with metrics woven in, no table. */
  axes: AxisAnalysis[];
  /** "Pitch Heatmap" — where the match has been played: the territory
   *  + red-zone read behind the heat map. */
  heatmap: string;
  /** All 8 in-match gaps, biggest first — chart feed for Match Gaps so
   *  the visual and the Match Gaps prose come off one engine. */
  gaps: MatchGapView[];
  /** Closing verdict — the match summarised through the control-vs-
   *  conversion lens (matches the pane's closing chart). NOT forward-
   *  looking: it seals the story the sections above told. */
  verdict: string;
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

  // Match-flow read (lead changes, decisive run) IS the "Scoring
  // Progression" narrative — the scoreboard story its chart draws.
  const flow = buildMatchFlow(ctx.events, home, away, isLive);

  return {
    summary: buildSummary(result, home, away, isLive, generatedAtMinute),
    momentum: shapeParagraph(result, home, away, isLive, generatedAtMinute),
    attackPattern: attackParagraph(result, home, away, ctx),
    platform: platformParagraph(result, home, away, isLive, generatedAtMinute),
    heatmap: buildHeatmapRead(result, home, away, isLive),
    progression:
      flow ||
      (isLive
        ? `No scoring swings to chart yet — the progression read opens with the first score. Until it lands, this is a contest of field position and patience, and the first side to cash a 22 visit writes the opening line of the story.`
        : `The scoreboard never produced a swing worth charting: no lead changes, no decisive run — a match that moved in inches. Test matches that finish without a single charted swing are rare, and this one was settled in the margins the other cards describe.`),
    variance: buildVariance(result, home, away, isLive, ctx),
    gaps: computeAxisGaps(result)
      .map((g) => ({
        key: g.key,
        label: g.label,
        norm: ((g.advantage === 'home' ? 1 : -1) * g.signedGap) / gapThreshold(g.key),
      }))
      .sort((x, y) => Math.abs(y.norm) - Math.abs(x.norm)),
    axes,
    verdict: buildVerdict(result, home, away, isLive),
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
/** "Pitch Heatmap" — where the match has been played: territory share
 *  and what the visits produced (the heat map in words). */
function buildHeatmapRead(result: Result, home: Team, away: Team, isLive: boolean): string {
  const ht = result.home_territory_percent;
  const leader = ht >= 50 ? home : away;
  const share = Math.round(Math.max(ht, 100 - ht));
  const lEntries = leader === home ? result.home_twenty_two_entries : result.away_twenty_two_entries;
  const lPts = leader === home ? result.home_points_from_twenty_two_entries : result.away_points_from_twenty_two_entries;
  const ppe = lEntries > 0 ? (lPts / lEntries).toFixed(1) : null;
  const tense = isLive ? 'has been played' : 'was played';
  if (share <= 53) {
    return `The map splits close to even: neither side ${isLive ? 'has owned' : 'owned'} the ground, and the heat sits through the middle third — a field-position stalemate that ${isLive ? 'is pushing' : 'pushed'} the contest onto execution instead.`;
  }
  const base = `Most of this match ${tense} in ${leader === home ? away.short_name : home.short_name}'s half: ${leader.short_name} ${isLive ? 'have carried' : 'carried'} ${share}% of the territory read.`;
  if (ppe !== null) {
    return `${base} The heat tells the value of it — ${lEntries} visits to the 22 at ${ppe} points a visit is ${Number(ppe) >= 2.5 ? 'pressure being cashed in' : 'pressure going unconverted, which keeps the door open'}.`;
  }
  return `${base} The caveat sits in the visits column: not one 22 entry ${isLive ? 'has come' : 'came'} from all that position, so the pressure ${isLive ? 'is still' : 'stayed'} theoretical rather than converted.`;
}

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

  // Supporting reads, priority-ordered behind the lead-change story
  // (spec §5.7: finding first, context second, colour last — the card
  // trims from the tail).
  const first = scoring[0]!;
  const firstSide = first.team_id === home.id ? home : away;
  parts.push(
    `First blood went to ${firstSide.short_name} in the ${ordinalRank(Math.max(1, first.minute))} minute, and the opening exchanges set the terms for what followed.`,
  );

  const h1h = scoring.filter((e) => e.minute <= 40 && e.team_id === home.id).reduce((n, e) => n + e.points, 0);
  const h1a = scoring.filter((e) => e.minute <= 40 && e.team_id !== home.id).reduce((n, e) => n + e.points, 0);
  const h2h = h - h1h;
  const h2a = a - h1a;
  if (h2h + h2a > 0 && h1h + h1a > 0) {
    parts.push(
      `By period the points split ${h1h}-${h1a} before the interval and ${h2h}-${h2a} after it, the ${h1h + h1a >= h2h + h2a ? 'first' : 'second'} forty carrying the heavier scoring.`,
    );
  }

  let drought = 0;
  let prevMinute = 0;
  for (const e of scoring) {
    if (e.minute - prevMinute > drought) drought = e.minute - prevMinute;
    prevMinute = e.minute;
  }
  if (!isLive && 80 - prevMinute > drought) drought = 80 - prevMinute;
  if (drought >= 15) {
    parts.push(
      `The longest quiet spell ${isLive ? 'so far is' : 'was'} ${drought} scoreless minutes, a reminder that the defences ${isLive ? 'are having' : 'had'} their say in this as well.`,
    );
  }

  if (scoring.length > 1) {
    const last = scoring[scoring.length - 1]!;
    const lastSide = last.team_id === home.id ? home : away;
    parts.push(
      `The ${isLive ? 'latest' : 'last'} score ${isLive ? 'belongs' : 'belonged'} to ${lastSide.short_name} in the ${ordinalRank(Math.max(1, last.minute))} minute${isLive ? '' : ', the full stop on the contest'}.`,
    );
  }

  parts.push(
    scoring.length >= 10
      ? `With ${scoring.length} scoring acts on the timeline, this ${isLive ? 'is' : 'was'} a scoreboard that rarely sat still.`
      : `With ${scoring.length} scoring acts on the timeline, each visit to the scoreboard ${isLive ? 'carries' : 'carried'} real weight.`,
  );

  return parts.join(' ');
}

function liveMinuteFromKickoff(fixture: Fixture): number {
  const elapsed = Math.floor((Date.now() - new Date(fixture.kickoff_utc).getTime()) / 60000);
  return Math.min(80, Math.max(0, elapsed));
}

// ─── Pre-match context ──────────────────────────────────────────────────────



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
  let lead: string;
  if (isLive) {
    if (!leader) lead = `Level at ${currentMinute}' (${scoreline}), and neither side has yet found the edge that breaks this open.`;
    else if (margin >= 14) lead = `${leader.short_name} are pulling clear at ${currentMinute}' (${scoreline}). This is a two-score match at minimum now, and the chase gets harder by the minute.`;
    else if (margin >= 7) lead = `${leader.short_name} lead at ${currentMinute}' (${scoreline}), and the chasing side need at least a converted score just to draw level.`;
    else lead = `Tight at ${currentMinute}' (${scoreline}). ${leader.short_name} hold the edge, but one score flips this.`;
  } else if (!leader) {
    lead = `Full-time: ${scoreline}. Two sides who cancelled each other out, neither finding an edge it could hold long enough to win the game.`;
  } else if (margin >= 20) {
    lead = `Full-time: ${scoreline}. ${leader.short_name} won this comprehensively, a ${margin}-point margin that settles any argument about who controlled it.`;
  } else if (margin >= 10) {
    lead = `Full-time: ${scoreline}. ${leader.short_name} took it with room to spare, clear where Test matches are decided.`;
  } else {
    lead = `Full-time: ${scoreline}. A tight contest settled by fine margins rather than any one-sided dimension.`;
  }
  return `${lead} ${summaryDetail(result, home, away, isLive, margin)}`;
}

/** Supporting sentences for the summary card, priority-ordered per spec
 *  §5.7: try shape, then control, then red-zone value, then discipline,
 *  colour last. Display packs whole sentences and trims from the tail. */
function summaryDetail(result: Result, home: Team, away: Team, isLive: boolean, margin: number): string {
  const past = !isLive;
  const s: string[] = [];

  const homeT = result.home_tries;
  const awayT = result.away_tries;
  if (homeT + awayT === 0) {
    s.push(`Neither side ${past ? 'crossed' : 'has crossed'} the whitewash, so every point ${past ? 'came' : 'has come'} off the tee.`);
  } else if (homeT !== awayT) {
    const tl = homeT > awayT ? home : away;
    s.push(`The try count ${past ? 'ran' : 'runs'} ${homeT}-${awayT}, and ${tl.short_name}'s strike play ${past ? 'did' : 'is doing'} the heavier scoring.`);
  } else {
    s.push(`Tries ${past ? 'finished' : 'sit'} level at ${homeT}-${awayT}, which leaves the tee and field position to account for whatever separates the sides.`);
  }

  const hp = Math.round(result.home_possession_percent);
  const hterr = Math.round(result.home_territory_percent);
  const possLeader = hp >= 50 ? home : away;
  const terrLeader = hterr >= 50 ? home : away;
  s.push(
    `Beneath the scoreline, ${possLeader.short_name} ${past ? 'held' : 'hold'} ${Math.max(hp, 100 - hp)}% of the ball while ${terrLeader.short_name} ${past ? 'took' : 'take'} ${Math.max(hterr, 100 - hterr)}% of the territory${possLeader.id === terrLeader.id ? ', control running through one side' : ', a split that keeps both game plans honest'}.`,
  );

  const homeEntries = result.home_twenty_two_entries;
  const awayEntries = result.away_twenty_two_entries;
  if (homeEntries + awayEntries > 0) {
    const rz = homeEntries >= awayEntries ? home : away;
    const entries = Math.max(homeEntries, awayEntries);
    const pts = rz.id === home.id ? result.home_points_from_twenty_two_entries : result.away_points_from_twenty_two_entries;
    const ppe = (pts / entries).toFixed(1);
    s.push(
      `${rz.short_name}'s ${entries} visits to the 22 ${past ? 'yielded' : 'have yielded'} ${pts} points, ${ppe} a visit, ${Number(ppe) >= 2.5 ? 'ruthless red-zone work' : `a return that ${past ? 'left' : 'leaves'} points out on the field`}.`,
    );
  }

  const homePens = result.home_penalties_conceded;
  const awayPens = result.away_penalties_conceded;
  if (Math.abs(homePens - awayPens) >= 3) {
    const worse = homePens > awayPens ? home : away;
    const better = worse.id === home.id ? away : home;
    s.push(`The penalty count ${past ? 'sat' : 'sits'} ${homePens}-${awayPens} against ${worse.short_name}, a steady feed of position and shots for ${better.short_name}.`);
  } else {
    s.push(`Discipline ${past ? 'held' : 'is holding'} on both sides (${homePens} penalties conceded to ${awayPens}), so neither ${past ? 'was' : 'is being'} gifted cheap exits.`);
  }

  if (past) {
    s.push(
      margin >= 10
        ? `Little in the underlying numbers argues with the result.`
        : `On another day the fine margins fall the other way, which is the truest measure of how close this was.`,
    );
  } else {
    s.push(
      margin >= 14
        ? `From here the chasers need multiple scores, and the clock is the leader's best defender.`
        : `There is time for the balance to move, and the bench battle usually decides matches with this profile.`,
    );
  }

  return s.join(' ');
}

// ─── Broadcast commentary ───────────────────────────────────────────────────

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
  const detail = momentumDetail(result, home, away, isLive, currentMinute);

  if (preHalfTime) {
    const leader = currentHome > currentAway ? home : currentAway > currentHome ? away : null;
    const margin = Math.abs(currentHome - currentAway);
    if (!leader) return `Still inside the first forty and dead level, two game plans probing away without either finding the first crack. ${detail}`;
    return `${leader.short_name} have the early running and a ${margin}-point cushion. The test between now and the break is carrying that shape through the restarts intact. ${detail}`;
  }

  if (isLive && inSecondHalf) {
    const halfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
    if (halfWinner) {
      const halfMargin = Math.abs(secondHalfHome - secondHalfAway);
      return `The half-time score read ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. Since the restart the match has belonged to ${halfWinner.short_name}, ${halfMargin} points the better of the second period. Whatever was said at the interval, it landed. ${detail}`;
    }
    return `Half-time read ${home.short_name} ${htHome}, ${away.short_name} ${htAway}, and the second period has kept the same shape. Neither break nor bench has shifted the balance yet. ${detail}`;
  }

  // Completed
  const secondHalfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
  const finalLeader = currentHome > currentAway ? home : currentAway > currentHome ? away : null;
  if (!secondHalfWinner && !finalLeader) {
    return `A draw at the whistle: ${home.short_name} ${currentHome}, ${away.short_name} ${currentAway}. From ${htHome}-${htAway} at the break, the second forty simply repeated the first. Two sides who mirrored each other for eighty minutes. ${detail}`;
  }
  if (secondHalfWinner && finalLeader && secondHalfWinner.id !== finalLeader.id) {
    return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${secondHalfWinner.short_name} won the second half (${secondHalfWinner.id === home.id ? secondHalfHome : secondHalfAway} points to ${secondHalfWinner.id === home.id ? secondHalfAway : secondHalfHome}) and made the closing stretch uncomfortable, but the cushion ${finalLeader.short_name} built before the interval proved the match's real currency. ${detail}`;
  }
  return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${finalLeader ? `${finalLeader.short_name} pushed on after the interval; the second forty is where this one was actually won.` : `The sides traded blows to the end without either landing the decisive one.`} ${detail}`;
}

/** Supporting momentum sentences behind the half-shape lead: quick-ball
 *  tempo first (the sharpest initiative signal), then defensive
 *  workload, then the footwork edge, colour last (spec §5.7 ordering). */
function momentumDetail(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  currentMinute: number,
): string {
  const past = !isLive;
  const s: string[] = [];

  const homeQuick = Math.round(result.home_ruck_speed_0_3s_percent);
  const awayQuick = Math.round(result.away_ruck_speed_0_3s_percent);
  if (Math.abs(homeQuick - awayQuick) >= 10) {
    const faster = homeQuick > awayQuick ? home : away;
    s.push(
      `Quick ball is the tempo tell: ${Math.max(homeQuick, awayQuick)}% of ${faster.short_name}'s rucks ${past ? 'produced' : 'are producing'} ball inside three seconds against ${Math.min(homeQuick, awayQuick)}%, and that speed gap is where the initiative actually lives.`,
    );
  } else {
    s.push(
      `Ruck speed ${past ? 'split' : 'splits'} ${homeQuick}% to ${awayQuick}% inside three seconds, so neither attack ${past ? 'consistently outran' : 'is consistently outrunning'} the defensive reset.`,
    );
  }

  const homeTk = result.home_tackles_made;
  const awayTk = result.away_tackles_made;
  if (Math.abs(homeTk - awayTk) >= 20) {
    const busier = homeTk > awayTk ? home : away;
    s.push(
      `The tackle count gives the pressure map away: ${busier.short_name} ${past ? 'made' : 'have made'} ${Math.max(homeTk, awayTk)} tackles to ${Math.min(homeTk, awayTk)}, and no side carries that workload without tiring.`,
    );
  } else {
    s.push(
      `Defensive workloads ${past ? 'ran' : 'are running'} close to even (${homeTk} tackles to ${awayTk}), the sign of a contest trading blows rather than one side camping in the other's half.`,
    );
  }

  const homeDB = result.home_defenders_beaten;
  const awayDB = result.away_defenders_beaten;
  if (Math.abs(homeDB - awayDB) >= 5) {
    const slippier = homeDB > awayDB ? home : away;
    s.push(
      `${slippier.short_name} ${past ? 'beat' : 'have beaten'} ${Math.max(homeDB, awayDB)} defenders to ${Math.min(homeDB, awayDB)}, the footwork edge that turns parity into momentum.`,
    );
  }

  s.push(
    past
      ? `That was the pulse of the eighty minutes, whatever the highlight reel suggests.`
      : `Momentum resets with every restart, and ${Math.max(0, 80 - currentMinute)} minutes leave room for it to swing again.`,
  );

  return s.join(' ');
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
    parts.push(
      `Execution will separate them from here: the handling ledger sits ${homeErr}-${awayErr}, and the cleaner side buys itself the extra platform.`,
    );
  }

  // Joined-component budget (spec §5.7): this opener is assembled with
  // axis narratives downstream, so it stays short with the sharpest
  // finding in the first sentence.
  return joinToCap(parts, 300);
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

  if (parts.length === 0) {
    parts.push(
      `The platform battle ${isLive ? 'is all square so far' : 'finished all square'}: solid set-piece on both sides, an even breakdown, kicking exchanges cancelling out. No hidden leverage in this one.`,
    );
  }

  // Closing thought — colour, last in priority, so the joined-component
  // cap drops it first when the substantive reads fill the budget.
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

  // Joined-component budget (spec §5.7): this opener is assembled with
  // axis narratives downstream, so it stays short with the sharpest
  // finding in the first sentence.
  return joinToCap(parts, 300);
}

/** Join priority-ordered sentences into one read, stopping before the
 *  total passes `cap`. The first sentence always survives — it carries
 *  the sharpest finding (spec §5.7 joined-component contract). */
function joinToCap(parts: readonly string[], cap: number): string {
  let out = parts[0] ?? '';
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i]!;
    if (out.length + 1 + next.length > cap) break;
    out = `${out} ${next}`;
  }
  return out;
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
  // Threshold-normalised ranking so a 2-penalty gap and a 10pp
  // possession gap compare fairly across axes.
  const ranked = gaps
    .slice()
    .sort((x, y) => Math.abs(y.signedGap) / gapThreshold(y.key) - Math.abs(x.signedGap) / gapThreshold(x.key));

  if (decisive.length === 0) {
    const s: string[] = [];
    s.push(
      isLive
        ? `Near-mirror numbers so far, with no dimension yet opening a decisive gap between ${home.short_name} and ${away.short_name}.`
        : `Near-mirror numbers throughout: no single dimension separated ${home.short_name} and ${away.short_name} decisively, and the match was settled in the margins.`,
    );
    const nearest = ranked[0]!;
    s.push(
      `Nearest to a real split ${isLive ? 'is' : 'was'} ${nearest.label.toLowerCase()}, ${gapPhrase(nearest)} in ${(nearest.advantage === 'home' ? home : away).short_name}'s favour, still short of the line this read treats as decisive.`,
    );
    const second = ranked[1]!;
    s.push(
      `Behind it ${isLive ? 'sits' : 'sat'} ${second.label.toLowerCase()} at ${gapPhrase(second)}, the same story in miniature.`,
    );
    s.push(
      `${home.short_name} and ${away.short_name} ${isLive ? 'have produced' : 'produced'} matching profiles across attack, defence and the platform axes alike, the statistical signature of a genuine arm-wrestle.`,
    );
    s.push(
      isLive
        ? `Even matches break eventually, and when this one does, the first axis through its threshold will be the tell.`
        : `When nothing separates the profiles, the winning of it comes down to moments, and the progression card holds those.`,
    );
    return s.join(' ');
  }

  const homeWinners = decisive.filter((g) => g.advantage === 'home');
  const awayWinners = decisive.filter((g) => g.advantage === 'away');
  const rank = (a: AxisGap, b: AxisGap) => Math.abs(b.signedGap) - Math.abs(a.signedGap);
  const topHome = homeWinners.slice().sort(rank).slice(0, 2);
  const topAway = awayWinners.slice().sort(rank).slice(0, 2);

  const parts: string[] = [];
  if (topHome.length) parts.push(`${home.short_name} ${isLive ? 'ahead' : 'came out ahead'} on ${listGapLabels(topHome)}`);
  if (topAway.length) parts.push(`${away.short_name} ${isLive ? 'ahead' : 'ended up ahead'} on ${listGapLabels(topAway)}`);

  const s: string[] = [];
  s.push(
    isLive
      ? `The gaps that matter are opening up: ${parts.join('; ')}. Those are the dimensions writing the scoreboard.`
      : `The gaps that mattered are plain: ${parts.join('; ')}. Those were the dimensions that wrote the scoreboard.`,
  );

  const widest = ranked[0]!;
  s.push(
    `The widest split ${isLive ? 'is' : 'was'} ${widest.label.toLowerCase()}, ${gapPhrase(widest)} in ${(widest.advantage === 'home' ? home : away).short_name}'s favour.`,
  );

  const evenCount = gaps.length - decisive.length;
  s.push(
    decisive.length >= 4
      ? `With ${decisive.length} of the eight axes past the decisive line, the advantage ${isLive ? 'is' : 'was'} broad rather than built on one front.`
      : `The other ${evenCount} axes ${isLive ? 'sit' : 'sat'} inside the noise band, so this ${isLive ? 'is a match being decided' : 'was a match decided'} on specific fronts, not across the board.`,
  );

  const nearMiss = ranked.find((g) => Math.abs(g.signedGap) < gapThreshold(g.key));
  if (nearMiss) {
    s.push(`Closest to joining the list ${isLive ? 'is' : 'was'} ${nearMiss.label.toLowerCase()}, just shy of its threshold.`);
  }

  s.push(
    isLive
      ? `Gaps at this stage either harden or close; the next passage of sustained pressure will say which.`
      : `Set those gaps against the final scoreline and the story tells itself.`,
  );
  return s.join(' ');
}

/** Human phrase for an axis gap's magnitude, in that axis's own unit. */
function gapPhrase(g: AxisGap): string {
  const v = Math.round(g.signedGap);
  switch (g.key) {
    case 'attack':
    case 'defence':
      return `a ${v}-point gap`;
    case 'discipline':
      return `a ${v}-penalty gap`;
    case 'turnovers':
      return `a ${v}-turnover gap`;
    case 'kicking':
      return `${v} metres a kick`;
    default:
      return `${v} percentage points`;
  }
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

  // Penetration numbers back-fill the read when no baseline story fires,
  // keeping the component inside its 250-350 joined budget either way.
  const penetrationLine = varianceLine
    ? ''
    : ` The penetration numbers behind it: ${result.home_line_breaks} line breaks to ${result.away_line_breaks}, and ${Math.round(result.home_meters)} carry metres against ${Math.round(result.away_meters)}.`;

  return `${openLine}${tryLine}${varianceLine}${penetrationLine}`;
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

  const workloadLine = varianceLine
    ? ''
    : ` Behind the line speed, the workload split ${result.home_tackles_made} tackles (${result.home_dominant_tackles} dominant) for ${home.short_name} against ${result.away_tackles_made} (${result.away_dominant_tackles}) for ${away.short_name}.`;

  return `${openLine}${tackleLine}${varianceLine}${workloadLine}`;
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
  // (8+ mauls won) or a liability (2+ lost). When no maul story fires,
  // the raw platform counts back-fill the 250-350 joined budget instead.
  const maulSentence = maulRead(result, home, away);
  const setPieceTail =
    maulSentence ||
    ` For volume, the platforms read ${result.home_scrums_won} scrums and ${result.home_lineouts_won} lineouts won for ${home.short_name} against ${result.away_scrums_won} and ${result.away_lineouts_won} for ${away.short_name}.`;

  if (Math.max(homeScrumLost, awayScrumLost) >= 2) {
    const worse = homeScrumLost > awayScrumLost ? home : away;
    return `The scrum is where the pressure is telling. ${worse.short_name} keep losing their own feed, and every lost engagement walks the opposing pack up-field for free.${setPieceTail}`;
  }
  if (Math.max(homeLineoutLost, awayLineoutLost) >= 3) {
    const worse = homeLineoutLost > awayLineoutLost ? home : away;
    return `The leak is at the lineout. ${worse.short_name}'s throw-and-jump timing has not held, each misfire hands attacking territory straight back, and their launch platform has to come from somewhere else.${setPieceTail}`;
  }
  return `Both packs have looked after their own ball, and the set-piece has cancelled out. With no easy possession off the platform, the points have had to be built in open play.${setPieceTail}`;
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
    return `Cards on both sides have left each defence covering fourteen-man phases, and the contest has carried a scrappy disciplinary edge because of it. Neither side has been decisively punished. The ledger beneath the cards reads ${homePens} penalties against ${home.short_name} and ${awayPens} against ${away.short_name}.`;
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
  return `Discipline has held on both sides. With the whistle largely staying in the referee's pocket, neither side is being gifted shots at goal, and the contest is being settled by play rather than penalty. The counts sit at ${homePens} and ${awayPens}, Test-standard discipline from both camps.`;
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
  // When none has landed, the raw boot volumes back-fill the 250-350
  // joined budget instead.
  const fiftyTwentyTwo = fiftyTwentyTwoRead(result, home, away);
  const kickTail =
    fiftyTwentyTwo ||
    ` For volume, the boot count reads ${homeKIP} kicks in play and ${Math.round(result.home_kick_meters)} kicked metres against ${awayKIP} and ${Math.round(result.away_kick_meters)}.`;

  if (Math.abs(homeM - awayM) >= 8) {
    const better = homeM > awayM ? home : away;
    return `The territorial kicking duel has gone ${better.short_name}'s way. More distance per kick means the exits keep landing deeper, and the game keeps being played where they want it. A quiet edge, but a decisive one.${kickTail}`;
  }
  if (Math.abs(homeKIP - awayKIP) >= 6) {
    const kicker = homeKIP > awayKIP ? home : away;
    return `${kicker.short_name} have made the boot their strategy, kicking far more often and trusting field position over phase count. That is a choice, not a shortage of ideas.${kickTail}`;
  }
  return `Kicking exchanges have cancelled out, both boots finding similar lengths and neither back three winning the air decisively. The territorial contest is being fought elsewhere.${kickTail}`;
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
  const homeTerr = Math.round(result.home_territory_percent);
  const detail = ` The split stands at ${homeTerr}% to ${100 - homeTerr}%, and 22 entries run ${result.home_twenty_two_entries}-${result.away_twenty_two_entries} on the back of it.`;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    const trailing = delta > 0 ? away : home;
    return `Territory has swung heavily ${dominant.short_name}'s way. That leaves ${trailing.short_name} defending from deep for long stretches, and sustained pressure of that kind eventually cracks most lines. Whether it converts is the open question.${detail}`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `The field-position battle is tilting towards ${dominant.short_name}, less an avalanche than a slow squeeze up-field. The pressure is building rather than exploding.${detail}`;
  }
  return `Neither side has managed to pin the other back; the game has lived in the middle third, and even geography like that suits the defences.${detail}`;
}

function possessionNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_possession_percent - result.away_possession_percent;
  const homePoss = Math.round(result.home_possession_percent);
  const detail = ` The share reads ${homePoss}% to ${100 - homePoss}%, built on ${result.home_carries} carries to ${result.away_carries} and ${result.home_passes} passes to ${result.away_passes}.`;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    return `Access to the ball is not ${dominant.short_name}'s problem; they have monopolised it. What that heavy lean demands is conversion, and the phase count has to start paying in points before the door closes on it.${detail}`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `${dominant.short_name} are shading the ball and setting the tempo, asking the opposition to make more tackles than they would like. A steady lean, not a landslide.${detail}`;
  }
  return `Possession has split near-even, both sides backing their carry-and-recycle game, so what separates them is efficiency rather than volume of touches.${detail}`;
}

function turnoversNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_turnovers_won - result.away_turnovers_won;
  const total = result.home_turnovers_won + result.away_turnovers_won;
  const detail = ` The ledger stands at ${result.home_turnovers_won}-${result.away_turnovers_won} won, with ${result.home_turnovers_conceded} and ${result.away_turnovers_conceded} coughed up going the other way.`;
  if (Math.abs(delta) >= 4) {
    const better = delta > 0 ? home : away;
    return `The breakdown contest has a clear winner. ${better.short_name} keep coming away with opposition ball, and each steal is a possession swing plus a counter-attack the other side has to defend. That double cost is why turnovers hurt twice.${detail}`;
  }
  if (total >= 15) {
    return `Turnovers are flying at both ends, ball retention at a premium and the breakdown a fight every phase. Chaos of that kind usually rewards the sharper counter-attack.${detail}`;
  }
  return `Little to choose at the breakdown, with neither side winning the contact area decisively; this has flowed as a phase-count contest rather than a broken-field one.${detail}`;
}

// ─── Closing verdict ────────────────────────────────────────────────────────

/**
 * Closing verdict — the match read back through the control-vs-
 * conversion lens (the pane's closing chart): who held the ball and
 * the ground, who turned control into points, and which of the two
 * settled it. A summary that seals the story, never a forward look
 * (that job belongs to the team cards' Outlook sections).
 */
function buildVerdict(result: Result, home: Team, away: Team, isLive: boolean): string {
  const homeCtrl = (result.home_possession_percent + result.home_territory_percent) / 2;
  const awayCtrl = 100 - homeCtrl;
  const controller = homeCtrl >= awayCtrl ? home : away;
  const ctrlShare = Math.round(Math.max(homeCtrl, awayCtrl));
  const controllerScore = controller === home ? result.home_score : result.away_score;
  const otherScore = controller === home ? result.away_score : result.home_score;
  const other = controller === home ? away : home;
  const tight = ctrlShare <= 53;
  const detail = verdictDetail(result, home, away, isLive, controller);

  if (tight) {
    const leader = result.home_score >= result.away_score ? home : away;
    const lead = Math.abs(result.home_score - result.away_score);
    if (lead === 0) {
      return isLive
        ? `The story so far in one line: control split down the middle and nothing between them on the scoreboard — whoever converts the next visit tilts it. ${detail}`
        : `The story in one line: control split down the middle, and the scoreboard never escaped it — a match settled in the margins rather than won by either shape. ${detail}`;
    }
    return isLive
      ? `The story so far in one line: neither side owns the ball or the ground, but ${leader.short_name} are ${lead} up on conversion alone. Control is even; the kicking of chances isn't. ${detail}`
      : `The story in one line: control was even all day, and ${leader.short_name} won it on conversion — ${lead} the margin between two sides who shared the ball and the ground. ${detail}`;
  }

  if (controllerScore >= otherScore) {
    return isLive
      ? `The story so far in one line: ${controller.short_name} hold ${ctrlShare}% of the control read and the scoreboard with it — control is being converted, and ${other.short_name} are living off scraps. ${detail}`
      : `The story in one line: ${controller.short_name} took ${ctrlShare}% of the control read and made it pay on the scoreboard — the match went the way the ball did. ${detail}`;
  }
  return isLive
    ? `The story so far in one line: ${controller.short_name} own the ball at ${ctrlShare}% of the control read, but ${other.short_name} own the scoreboard — conversion is beating control, the oldest upset shape in rugby. ${detail}`
    : `The story in one line: ${controller.short_name} controlled it at ${ctrlShare}% and lost it anyway — ${other.short_name} converted what little they had, and conversion beat control. ${detail}`;
}

/** Supporting sentences behind the verdict's one-line lead: decompose
 *  the control read, price both sides' red-zone conversion, seal with
 *  the scoreline, colour last (spec §5.7 ordering). */
function verdictDetail(
  result: Result,
  home: Team,
  away: Team,
  isLive: boolean,
  controller: Team,
): string {
  const past = !isLive;
  const s: string[] = [];

  const ctrlPoss = Math.round(controller.id === home.id ? result.home_possession_percent : result.away_possession_percent);
  const ctrlTerr = Math.round(controller.id === home.id ? result.home_territory_percent : result.away_territory_percent);
  s.push(
    `Unpacked, the control read ${past ? 'came from' : 'comes from'} ${ctrlPoss}% of possession and ${ctrlTerr}% of territory in ${controller.short_name}'s column.`,
  );

  const homeEntries = result.home_twenty_two_entries;
  const awayEntries = result.away_twenty_two_entries;
  if (homeEntries + awayEntries > 0) {
    const homePPE = homeEntries > 0 ? (result.home_points_from_twenty_two_entries / homeEntries).toFixed(1) : '0.0';
    const awayPPE = awayEntries > 0 ? (result.away_points_from_twenty_two_entries / awayEntries).toFixed(1) : '0.0';
    s.push(
      `Conversion ${past ? 'was' : 'is'} the other half of the ledger: ${home.short_name} ${past ? 'took' : 'have taken'} ${homePPE} points a visit from ${homeEntries} trips to the 22, ${away.short_name} ${awayPPE} from ${awayEntries}.`,
    );
  }

  s.push(
    past
      ? `The final ledger, ${home.short_name} ${result.home_score}-${result.away_score} ${away.short_name}, is the sum of those two lines.`
      : `At ${home.short_name} ${result.home_score}-${result.away_score} ${away.short_name}, the scoreboard is tracking that equation faithfully so far.`,
  );

  s.push(
    past
      ? `Control and conversion are the whole game in miniature, and between them they close the book on this one.`
      : `Control and conversion rarely stay out of step for a full eighty; whichever bends first decides the run-in.`,
  );

  return s.join(' ');
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
