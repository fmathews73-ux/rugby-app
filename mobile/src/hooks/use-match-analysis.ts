import { useMemo } from 'react';

import type { Fixture, Result, Team } from '@rugby-app/shared';

import { useFixture, useFixtureResult, useTeams } from '@/api/hooks';
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
  const homeForm = useTeamRecentForm(homeTeamId, CONTEXT_FORM_LOOKBACK);
  const awayForm = useTeamRecentForm(awayTeamId, CONTEXT_FORM_LOOKBACK);

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
    });
  }, [
    fixture.data,
    result.data,
    teams.data,
    homeAgg.data,
    awayAgg.data,
    homeForm.outcomes,
    awayForm.outcomes,
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

  return {
    summary: buildSummary(result, home, away, isLive, generatedAtMinute),
    context: buildContext(home, away, ctx),
    commentary: buildCommentary(result, home, away, isLive, generatedAtMinute, ctx),
    variance: buildVariance(result, home, away, isLive, ctx),
    axes,
    outlook: buildOutlook(result, home, away, isLive, ctx),
    generatedAtMinute,
    status: isLive ? 'live' : 'completed',
  };
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
  const homeSummary = teamContextSentence(home, ctx.homeAgg, ctx.homeForm);
  const awaySummary = teamContextSentence(away, ctx.awayAgg, ctx.awayForm);
  const contrast = contrastSentence(home, away, ctx.homeAgg, ctx.awayAgg);
  return [homeSummary, awaySummary, contrast].filter(Boolean).join(' ');
}

function teamContextSentence(
  team: Team,
  agg: TeamAggregate | undefined,
  form: readonly FormOutcome[],
): string {
  const formBits: string[] = [];
  const wins = form.filter((f) => f === 'W').length;
  const losses = form.filter((f) => f === 'L').length;
  const draws = form.filter((f) => f === 'D').length;
  if (form.length > 0) {
    if (wins >= 4) formBits.push(`riding a run of ${wins} wins in their last ${form.length}`);
    else if (losses >= 4) formBits.push(`under pressure after ${losses} losses in their last ${form.length}`);
    else if (wins > losses) formBits.push(`in decent shape (${wins}-${losses}${draws ? '-' + draws : ''} over their last ${form.length})`);
    else if (losses > wins) formBits.push(`hunting form (${wins}-${losses}${draws ? '-' + draws : ''} over their last ${form.length})`);
    else formBits.push(`splitting recent results ${wins}-${losses}${draws ? '-' + draws : ''}`);
  }
  const aggBits: string[] = [];
  if (agg && agg.gamesPlayed > 0) {
    const pts = agg.perGame.pointsScored;
    const conc = agg.perGame.pointsConceded;
    aggBits.push(`averaging ${pts.toFixed(0)} points scored and ${conc.toFixed(0)} conceded per game`);
  }
  if (formBits.length === 0 && aggBits.length === 0) {
    return `${team.short_name} arrive with no prior season data to lean on.`;
  }
  const trailing = [...formBits, ...aggBits].join(' and ');
  return `${team.short_name} come in ${trailing}.`;
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
    return `On season attacking output, that's a ${Math.abs(gap).toFixed(0)}-point-per-game edge to ${better.short_name}, and the pre-match variance points to which side owns the front foot.`;
  }
  if (Math.abs(defGap) >= 8) {
    const better = defGap < 0 ? home : away;
    return `Defensively, ${better.short_name} arrive with the tighter line (${Math.abs(defGap).toFixed(0)} fewer points shipped per game across the season).`;
  }
  return `On season baselines the two sides read as evenly matched, so this fixture will turn on execution rather than form.`;
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
    if (!leader) return `Level at ${currentMinute}' (${scoreline}). Every axis of the profile is currently in the balance.`;
    if (margin >= 14) return `${leader.short_name} pulling clear at ${currentMinute}', ${scoreline}. The profile is opening up in their favour across multiple axes.`;
    if (margin >= 7) return `${leader.short_name} in front at ${currentMinute}', ${scoreline}. The two profiles are close but leaning ${leader.short_name}'s way.`;
    return `Tight at ${currentMinute}', ${scoreline}. ${leader.short_name} lead by ${margin} but the two profiles are running near-identical.`;
  }
  if (!leader) return `Full-time: ${scoreline}. The two profiles cancelled out, with no side finding a dimension it could exploit for long enough to decide it.`;
  if (margin >= 20) return `Full-time: ${scoreline}. ${leader.short_name} outperformed on the majority of profile axes and the scoreboard reflected it.`;
  if (margin >= 10) return `Full-time: ${scoreline}. ${leader.short_name} controlled the axes that matter most and took the win comfortably.`;
  return `Full-time: ${scoreline}. A tight profile match-up decided by a small number of key axes.`;
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
    if (!leader) return `Inside the opening 40 and both sides are still feeling each other out, with nothing separating them on the scoreboard as we head towards half-time.`;
    return `${leader.short_name} carrying the early momentum with a ${margin}-point cushion. The first quarter has belonged to them, and the challenge now is holding that shape as we approach the break.`;
  }

  if (isLive && inSecondHalf) {
    const halfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
    if (halfWinner) {
      const halfMargin = Math.abs(secondHalfHome - secondHalfAway);
      return `${home.short_name} took ${htHome} into the sheds against ${away.short_name}'s ${htAway}, and the second half has swung ${halfWinner.short_name}'s way by ${halfMargin}. The break clearly refined something in their game plan, and the coach's message evidently landed.`;
    }
    return `Half-time read ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. The second half has stayed just as tight, with neither coaching box unlocking a decisive edge yet.`;
  }

  // Completed
  const secondHalfWinner = secondHalfHome > secondHalfAway ? home : secondHalfAway > secondHalfHome ? away : null;
  const finalLeader = currentHome > currentAway ? home : currentAway > currentHome ? away : null;
  if (!secondHalfWinner && !finalLeader) {
    return `A draw at the whistle: ${home.short_name} ${currentHome}, ${away.short_name} ${currentAway}. Half-time ${htHome}-${htAway}, and the second forty carried on in exactly the same rhythm as the first. Two sides who mirrored each other for eighty.`;
  }
  if (secondHalfWinner && finalLeader && secondHalfWinner.id !== finalLeader.id) {
    return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${secondHalfWinner.short_name} came out the sharper side after the break (${secondHalfWinner.id === home.id ? secondHalfHome : secondHalfAway} points to ${secondHalfWinner.id === home.id ? secondHalfAway : secondHalfHome} in the second half), but ${finalLeader.short_name} had built a big enough cushion to hold on for the win.`;
  }
  return `Half-time: ${home.short_name} ${htHome}, ${away.short_name} ${htAway}. ${finalLeader ? `${finalLeader.short_name} extended their lead in the second half, and the scoreboard tells you which side made the better use of the break.` : `The two sides continued to trade blows after the interval without a decisive turning point.`}`;
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
        `${better.short_name} finding the softer edges (${betterCount} line breaks against ${Math.min(homeLB, awayLB)}), and that's noticeably above their ${betterBase.toFixed(1)}-per-game season average.`,
      );
    } else {
      parts.push(
        `${better.short_name} finding the softer edges. A count of ${betterCount} line breaks against ${Math.min(homeLB, awayLB)} tells you which attacking system is asking the harder questions.`,
      );
    }
  } else if (homeLB + awayLB >= 6) {
    parts.push(
      `Line breaks running high on both sides (${homeLB}-${awayLB}), suggesting an open, expansive game rather than an arm-wrestle.`,
    );
  }

  if (Math.abs(homeM - awayM) >= 100) {
    const better = homeM > awayM ? home : away;
    parts.push(
      `${better.short_name} racking up the metres carried (${Math.round(Math.max(homeM, awayM))}m vs ${Math.round(Math.min(homeM, awayM))}m), with ball-in-hand dominance the story of their attacking shift.`,
    );
  }

  // Offloads — attacking flair
  const homeOff = result.home_offloads ?? 0;
  const awayOff = result.away_offloads ?? 0;
  if (Math.max(homeOff, awayOff) >= 8) {
    const better = homeOff > awayOff ? home : away;
    parts.push(
      `${better.short_name}'s offloading game (${Math.max(homeOff, awayOff)} in the match) speaks to the pattern: high-tempo, hands-first attacking that refuses to let the collision end the phase.`,
    );
  }

  // Tries + conversions — finishing
  const totalTries = result.home_tries + result.away_tries;
  const homeConv = result.home_conversions ?? 0;
  const awayConv = result.away_conversions ?? 0;
  if (totalTries > 0) {
    parts.push(
      `Tries came in at ${result.home_tries}-${result.away_tries}, conversions ${homeConv}-${awayConv}, and the fly-halves' boots have done their share of the finishing work.`,
    );
  }

  // Handling — attacking execution
  const homeErr = result.home_handling_errors ?? 0;
  const awayErr = result.away_handling_errors ?? 0;
  if (Math.max(homeErr, awayErr) >= 12) {
    const worse = homeErr > awayErr ? home : away;
    parts.push(
      `${worse.short_name}'s handling has let them down (${Math.max(homeErr, awayErr)} errors in the match), meaning opportunities left on the floor.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      `The attacking read is close: line breaks ${homeLB}-${awayLB}, metres ${Math.round(homeM)}-${Math.round(awayM)}, tries ${result.home_tries}-${result.away_tries}. Neither back line has been able to consistently ask the harder questions of the other.`,
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
      `${kicker.short_name} the more kick-heavy of the two (${Math.max(homeKIP, awayKIP)} kicks in play against ${Math.min(homeKIP, awayKIP)}): deliberate territorial rugby, willing to hand the ball back for field position.`,
    );
  }
  if (homeKM + awayKM > 0 && Math.abs(homeKM - awayKM) >= 200) {
    const better = homeKM > awayKM ? home : away;
    parts.push(
      `${better.short_name}'s boot has produced ${Math.round(Math.max(homeKM, awayKM))}m of kicked distance against ${Math.round(Math.min(homeKM, awayKM))}m, winning the aerial territorial exchange.`,
    );
  } else if (homeKT + awayKT >= 20) {
    parts.push(
      `Kicks to touch have piled up (${homeKT}-${awayKT}): a lineout-heavy, structured game rather than a broken-field one.`,
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
      `${worseSet.short_name}'s set-piece has creaked at critical moments. Losing your own ball at scrum or lineout is the fastest way to bleed field position.`,
    );
  }

  // Turnovers / breakdown
  const homeTOW = result.home_turnovers_won ?? 0;
  const awayTOW = result.away_turnovers_won ?? 0;
  if (Math.abs(homeTOW - awayTOW) >= 4) {
    const jackaller = homeTOW > awayTOW ? home : away;
    parts.push(
      `${jackaller.short_name}'s breakdown work has been the standout (${Math.max(homeTOW, awayTOW)} turnovers won against ${Math.min(homeTOW, awayTOW)}), and every steal is a possession swing and a momentum killer.`,
    );
  }

  // Discipline / cards
  const homeCards = (result.home_yellow_cards ?? 0) + (result.home_red_cards ?? 0);
  const awayCards = (result.away_yellow_cards ?? 0) + (result.away_red_cards ?? 0);
  if (homeCards + awayCards > 0) {
    const carded = homeCards > awayCards ? home : awayCards > homeCards ? away : null;
    if (carded) {
      parts.push(
        `${carded.short_name} have shipped ${homeCards > awayCards ? homeCards : awayCards} card${(homeCards > awayCards ? homeCards : awayCards) === 1 ? '' : 's'}, and every minute a man short is a minute the game plan can't fully execute.`,
      );
    } else {
      parts.push('Cards to both sides gave the contest a scrappy, disciplinary edge.');
    }
  }

  // Closing thought
  if (isLive) {
    const remaining = Math.max(0, 80 - currentMinute);
    parts.push(
      `${remaining} minutes still to run, with plenty of time for the axis story to change if either side finds a fresh gear off the bench.`,
    );
  } else {
    parts.push(
      'Full-time confirmation of a match where the platform work (set-piece, breakdown, kicking exchange) did the quiet work behind whichever scoreline held up.',
    );
  }

  if (parts.length === 0) {
    return 'The platform battle was largely a stalemate: set-piece stable both sides, breakdown even, kicking exchanges finding the same lengths.';
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
    return `Near-mirror profiles across the eight axes, with no single dimension producing a decisive gap between ${home.short_name} and ${away.short_name}.`;
  }

  const homeWinners = decisive.filter((g) => g.advantage === 'home');
  const awayWinners = decisive.filter((g) => g.advantage === 'away');
  const rank = (a: AxisGap, b: AxisGap) => Math.abs(b.signedGap) - Math.abs(a.signedGap);
  const topHome = homeWinners.slice().sort(rank).slice(0, 2);
  const topAway = awayWinners.slice().sort(rank).slice(0, 2);

  const parts: string[] = [];
  if (topHome.length) parts.push(`${home.short_name} ahead on ${listGapLabels(topHome)}`);
  if (topAway.length) parts.push(`${away.short_name} ahead on ${listGapLabels(topAway)}`);
  const framing = isLive ? 'Where variance is opening up' : 'Where variance decided it';
  return `${framing}: ${parts.join('; ')}. Those are the dimensions writing the scoreboard.`;
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
    ? `${home.short_name}'s attack has been the more productive of the two (${homeS} points to ${away.short_name}'s ${awayS}) at the sharp end of the scoreboard.`
    : awayS > homeS
      ? `${away.short_name}'s attack has been the more productive of the two (${awayS} points to ${home.short_name}'s ${homeS}) at the sharp end of the scoreboard.`
      : `Both attacks reached the same output (${homeS} points each), but the paths there tell different stories.`;

  const tryLine = Math.abs(homeT - awayT) >= 2
    ? ` Tries have flowed ${homeT}-${awayT}, and that's the difference-maker, with ${homeT > awayT ? home.short_name : away.short_name}'s back-line asking the harder questions.`
    : homeT + awayT === 0
      ? ' Neither side has crossed the whitewash, and the boot is doing all the finishing today.'
      : ` Tries even at ${homeT}-${awayT}, meaning the extra scoreboard yield has come from set-piece and penalty accuracy rather than five-pointer flair.`;

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
    return ` ${home.short_name} are on for a season-best output, comfortably above their ${homeBase.toFixed(0)}-per-game norm.`;
  }
  if (awayBase && awayBase > 0 && awayS > awayBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} are on for a season-best output, comfortably above their ${awayBase.toFixed(0)}-per-game norm.`;
  }
  if (homeBase && homeBase > 0 && homeS < homeBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${home.short_name} sit well below their ${homeBase.toFixed(0)}-per-game attacking baseline, and the phase count isn't translating into points.`;
  }
  if (awayBase && awayBase > 0 && awayS < awayBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} sit well below their ${awayBase.toFixed(0)}-per-game attacking baseline, and the phase count isn't translating into points.`;
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
    ? `${home.short_name}'s defensive line has been the harder to break (${homeConceded} conceded against ${awayConceded} for ${away.short_name}).`
    : awayConceded < homeConceded
      ? `${away.short_name}'s defensive line has been the harder to break (${awayConceded} conceded against ${homeConceded} for ${home.short_name}).`
      : `Both defensive systems have conceded exactly the same (${homeConceded} apiece).`;

  const tackleLine = Math.abs(homeTackle - awayTackle) >= 5
    ? ` Tackle completion tips it further (${Math.round(Math.max(homeTackle, awayTackle))}% to ${Math.round(Math.min(homeTackle, awayTackle))}%), and line integrity is doing real work.`
    : ` Tackle completion is close (${Math.round(homeTackle)}% and ${Math.round(awayTackle)}%), so the concession gap is coming from field position rather than missed hits.`;

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
    return ` ${home.short_name} are shipping above their ${homeBase.toFixed(0)}-per-game season line, and this isn't the defensive shape they normally hold.`;
  }
  if (awayBase && awayConceded > awayBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return ` ${away.short_name} are conceding above their ${awayBase.toFixed(0)}-per-game season baseline, and the defensive system is under real strain.`;
  }
  return '';
}

function setPieceNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const homeScrumLost = result.home_scrums_lost ?? 0;
  const awayScrumLost = result.away_scrums_lost ?? 0;
  const homeLineoutLost = result.home_lineouts_lost ?? 0;
  const awayLineoutLost = result.away_lineouts_lost ?? 0;

  if (Math.max(homeScrumLost, awayScrumLost) >= 2) {
    const worse = homeScrumLost > awayScrumLost ? home : away;
    return `${worse.short_name}'s scrum has been the real point of pressure. Lost engagements at the set-piece are the fastest way to bleed field position, and ${worse.short_name} are shipping them today. The other pack is walking the game up-field on the back of that platform.`;
  }
  if (Math.max(homeLineoutLost, awayLineoutLost) >= 3) {
    const worse = homeLineoutLost > awayLineoutLost ? home : away;
    return `${worse.short_name}'s lineout has been the leak. Throw and jump sync isn't holding today, and every misfire hands attacking territory straight back. The primary attacking platform has to come from somewhere else.`;
  }
  return `Both packs have secured their own ball, and the set-piece has been an evenly-contested draw. Neither side is winning easy possession off the platform, so points have had to come from open play rather than structured launches.`;
}

function disciplineNarrative(result: Result, home: Team, away: Team, ctx: PreMatchContext): string {
  const homeCards = (result.home_yellow_cards ?? 0) + (result.home_red_cards ?? 0);
  const awayCards = (result.away_yellow_cards ?? 0) + (result.away_red_cards ?? 0);
  const homePens = result.home_penalties_conceded ?? 0;
  const awayPens = result.away_penalties_conceded ?? 0;

  if (homeCards + awayCards > 0) {
    const carded = homeCards > awayCards ? home : awayCards > homeCards ? away : null;
    if (carded) {
      return `${carded.short_name} have been forced to play part of the match short. Cards change territorial pressure and points-shipping risk substantially, and the impact has shown up in the scoreboard. The unshaded ${homeCards > awayCards ? away.short_name : home.short_name} side has managed the extra-man windows well.`;
    }
    return `Both sides have shipped cards, giving the contest a scrappy disciplinary edge that's forced both coaching boxes to close ranks and defend numerically compromised phases. Neither has been decisively punished.`;
  }
  if (Math.abs(homePens - awayPens) >= 3) {
    const worse = homePens > awayPens ? home : away;
    const worseCount = Math.max(homePens, awayPens);
    const worseBase =
      worse.id === home.id ? ctx.homeAgg?.perGame.penaltiesConceded : ctx.awayAgg?.perGame.penaltiesConceded;
    const varianceBit =
      worseBase && worseCount > worseBase * (1 + BASELINE_VARIANCE_THRESHOLD)
        ? ` That's well above their ${worseBase.toFixed(0)}-per-game season line and it's costing them field position at critical moments.`
        : '';
    return `${worse.short_name}'s discipline has been the concern. A heavier penalty count is keeping them pinned back and gifting the opposition points at the tee.${varianceBit}`;
  }
  return `Discipline has been broadly clean on both sides. The referee has kept the whistle mostly in the pocket, and neither side is giving the other easy shots at goal. That leaves the game in the players' hands.`;
}

function kickingNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const homeM = result.home_kicks_in_play > 0 ? result.home_kick_meters / result.home_kicks_in_play : 0;
  const awayM = result.away_kicks_in_play > 0 ? result.away_kick_meters / result.away_kicks_in_play : 0;
  const homeKIP = result.home_kicks_in_play ?? 0;
  const awayKIP = result.away_kicks_in_play ?? 0;

  if (Math.abs(homeM - awayM) >= 8) {
    const better = homeM > awayM ? home : away;
    return `${better.short_name}'s boot has been the more effective territorial weapon. More distance per kick means more field position won and the ability to pin the opposition deep. That aerial control has been a quiet but decisive edge.`;
  }
  if (Math.abs(homeKIP - awayKIP) >= 6) {
    const kicker = homeKIP > awayKIP ? home : away;
    return `${kicker.short_name} have been the more kick-heavy of the two, choosing deliberate territorial rugby that's willing to hand the ball back for field position rather than force phases through contact. It's a strategic choice, not a lack of ideas.`;
  }
  return `Kicking exchanges have been evenly matched, with both fly-halves finding similar lengths and neither back-three winning the aerial contest decisively. The territorial battle is being fought on other fronts.`;
}

function territoryNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_territory_percent - result.away_territory_percent;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    const trailing = delta > 0 ? away : home;
    return `${dominant.short_name} have squeezed the field decisively. Heavy territorial dominance means ${trailing.short_name} are defending from deep for long stretches, and that's the sort of sustained pressure that eventually breaks a defensive line. Whether it converts is the open question.`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `${dominant.short_name} have been the more territorially aggressive of the two, slowly walking the game up-field rather than blowing it open. The pressure is building rather than exploding.`;
  }
  return `Territory has been shared, with neither side pinning the other for extended stretches, and the game has stayed largely in the middle third of the field. That kind of even geography favours defensive systems.`;
}

function possessionNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_possession_percent - result.away_possession_percent;
  if (Math.abs(delta) >= 15) {
    const dominant = delta > 0 ? home : away;
    return `${dominant.short_name} have monopolised the ball, a heavy possession lean that says access isn't the problem, execution is. The question is whether that phase count converts into points before their opposition find a route back into the game.`;
  }
  if (Math.abs(delta) >= 8) {
    const dominant = delta > 0 ? home : away;
    return `${dominant.short_name} have been shading possession, playing the more patient phase count of the two and asking their opposition to defend more work. Not a landslide, but a steady tempo advantage.`;
  }
  return `Possession has split near-even, with both sides trusting their carry-and-recycle game about equally. Whichever side wins the game will have done it on efficiency rather than volume of touches.`;
}

function turnoversNarrative(result: Result, home: Team, away: Team, _ctx: PreMatchContext): string {
  const delta = result.home_turnovers_won - result.away_turnovers_won;
  const total = result.home_turnovers_won + result.away_turnovers_won;
  if (Math.abs(delta) >= 4) {
    const better = delta > 0 ? home : away;
    return `${better.short_name}'s breakdown work has been the standout. Each turnover won is a possession swing and a momentum killer, and they've been the more aggressive of the two at the ruck. Their opposition is going to have to defend those extra opportunities on the counter.`;
  }
  if (total >= 15) {
    return `A high-turnover contest on both sides, with the breakdown a battle every phase and ball retention at a premium. That kind of chaos usually favours the side with the sharper counter-attack.`;
  }
  return `Turnovers have run close, with neither breakdown winning the collisions decisively, and the game has flowed as a phase-count contest rather than a broken-field one.`;
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
    return `${framing}, both sides walk away with a broadly balanced read, and no single dimension jumps out as the pressing weakness. Marginal gains are where the next steps live.`;
  }
  return `${framing}, ${parts.join('; ')}. Those are the areas the coaching boxes will be circling in the review room.`;
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
    return `discipline in the tackle contest (playing short has been costly against ${oppTeam.short_name})`;
  }

  const conceded = side === 'home' ? result.away_score : result.home_score;
  const concededBase =
    side === 'home' ? ctx.homeAgg?.perGame.pointsConceded : ctx.awayAgg?.perGame.pointsConceded;
  if (concededBase && conceded > concededBase * (1 + BASELINE_VARIANCE_THRESHOLD)) {
    return `their defensive line (${conceded} points shipped is well above their ${concededBase.toFixed(0)}-per-game season norm)`;
  }

  const scrumLost =
    side === 'home' ? (result.home_scrums_lost ?? 0) : (result.away_scrums_lost ?? 0);
  const lineoutLost =
    side === 'home' ? (result.home_lineouts_lost ?? 0) : (result.away_lineouts_lost ?? 0);
  if (scrumLost >= 2 || lineoutLost >= 3) {
    return `their set-piece platform (losing their own ball at ${scrumLost >= 2 ? 'scrum' : 'lineout'} needs a fix at the review)`;
  }

  const pens =
    side === 'home' ? (result.home_penalties_conceded ?? 0) : (result.away_penalties_conceded ?? 0);
  const oppPens =
    side === 'home' ? (result.away_penalties_conceded ?? 0) : (result.home_penalties_conceded ?? 0);
  if (pens >= oppPens + 3) {
    return `their penalty count (a ${pens}-count is field position given away for free)`;
  }

  const scored = side === 'home' ? result.home_score : result.away_score;
  const scoredBase =
    side === 'home' ? ctx.homeAgg?.perGame.pointsScored : ctx.awayAgg?.perGame.pointsScored;
  if (scoredBase && scored < scoredBase * (1 - BASELINE_VARIANCE_THRESHOLD)) {
    return `their attacking conversion (${scored} points is well short of their ${scoredBase.toFixed(0)}-per-game season line)`;
  }

  return null;
}

// ─── Small helpers ──────────────────────────────────────────────────────────

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
