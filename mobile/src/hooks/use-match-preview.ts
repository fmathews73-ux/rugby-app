import { useMemo } from 'react';

import type { Team } from '@rugby-app/shared';

import { useFixture, useRankingHistory, useTeams } from '@/api/hooks';
import { type TeamAggregate, useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamPointsPattern, type TeamPointsPattern } from '@/hooks/use-team-points-pattern';
import { useTeamRecentForm, type FormOutcome } from '@/hooks/use-team-recent-form';

/**
 * TODO(phase-6): client-side TEMPLATE implementation of the PRE-MATCH
 * analysis narrative — replaced at Phase 6 by server-side LLM inference
 * whose system prompt is `docs/analysis-narrative-spec.md` §11, with
 * the `MatchPreview` interface as the response contract. Keep
 * structure, tone, and thresholds in lockstep with that doc, same as
 * the match / player / team analysis hooks.
 */

// Prev-10 window for the two sides' per-game profiles.
const WINDOW = 10;
const FORM_LOOKBACK = 5;
// Axis-gap thresholds — a dimension is only named as a likely
// battleground when the two profiles genuinely diverge.
const GAP_POINTS = 6; // points scored / conceded per game
const GAP_SET_PIECE = 4; // combined scrum+lineout success, pp
const GAP_DISCIPLINE = 2.5; // penalties conceded per game
const GAP_SHARE = 6; // possession / territory, pp
const GAP_TURNOVERS = 2; // net turnovers per game
const GAP_AERIAL = 12; // contestable-kick win rate, pp
// Quarter share (%) that reads as a real scoring-timing skew.
const TIMING_SKEW = 35;

/** The same 8 fixed axes the match analysis decomposes into — the
 *  pre-match card compares the two COMING-IN profiles on each. */
export type PreviewAxisKey =
  | 'attack'
  | 'defence'
  | 'set-piece'
  | 'discipline'
  | 'kicking'
  | 'territory'
  | 'possession'
  | 'turnovers'
  | 'aerial-delivered'
  | 'aerial-received';

export interface PreviewAxis {
  key: PreviewAxisKey;
  label: string;
  narrative: string;
}

/** Signed, threshold-normalised axis gap for chart surfaces (the Gap
 *  Ladder). norm > 0 = home ahead; |norm| ≥ 1 = clear edge, ≥ 0.5 =
 *  slight — the same tiers the narrative uses. */
export interface SignedGapView {
  key: PreviewAxisKey;
  label: string;
  norm: number;
}

export const AXIS_LABELS: Record<PreviewAxisKey, string> = {
  attack: 'Attack',
  defence: 'Defence',
  'set-piece': 'Set-piece',
  discipline: 'Discipline',
  kicking: 'Kicking',
  territory: 'Territory',
  possession: 'Possession',
  turnovers: 'Turnovers',
  'aerial-delivered': 'Aerial (kicked)',
  'aerial-received': 'Aerial (received)',
};

export interface MatchPreview {
  /** Unlabeled cold open — the billing (rankings + form collision). */
  summary: string;
  /** "The shape of it" — the axes the match will most likely turn on. */
  shape: string;
  /** Per-axis coming-in comparison — all 8, fixed order, tiered
   *  verdicts (clear edge / shades it / even) from fixed thresholds. */
  axes: PreviewAxis[];
  /** "Danger periods" — scoring-timing collision. Null when neither
   *  side shows a real quarter skew (section is omitted, not padded). */
  danger: string | null;
  /** "Keys to the match" — one condition per side, never a winner call. */
  keys: string;
  /** All 8 signed axis gaps, largest first — chart feed for the Gap
   *  Ladder so the visual and the narrative come off one engine. */
  gaps: SignedGapView[];
}

interface UseMatchPreviewResult {
  data: MatchPreview | null;
  isLoading: boolean;
}

export function useMatchPreview(fixtureId: string): UseMatchPreviewResult {
  const fixture = useFixture(fixtureId);
  const teams = useTeams();

  const homeTeamId = fixture.data?.home_team_id ?? '';
  const awayTeamId = fixture.data?.away_team_id ?? '';
  const asOfDate = fixture.data?.kickoff_utc;

  const homeAgg = useTeamAggregate(homeTeamId, asOfDate, WINDOW);
  const awayAgg = useTeamAggregate(awayTeamId, asOfDate, WINDOW);
  const homeForm = useTeamRecentForm(homeTeamId, FORM_LOOKBACK, asOfDate);
  const awayForm = useTeamRecentForm(awayTeamId, FORM_LOOKBACK, asOfDate);

  // Ranks as of kickoff — same read the Preview carousel charts.
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

  // Scoring-timing patterns, frozen as of kickoff — the preview
  // PERSISTS after the match completes (pre-match vs match analysis is
  // an intentional compare-read), so every input must exclude the
  // match itself and anything after it.
  const homeScored = useTeamPointsPattern(homeTeamId, 'scored', asOfDate, WINDOW);
  const awayScored = useTeamPointsPattern(awayTeamId, 'scored', asOfDate, WINDOW);
  const homeConceded = useTeamPointsPattern(homeTeamId, 'conceded', asOfDate, WINDOW);
  const awayConceded = useTeamPointsPattern(awayTeamId, 'conceded', asOfDate, WINDOW);

  const data = useMemo<MatchPreview | null>(() => {
    if (!fixture.data || !teams.data) return null;
    // Computed for scheduled, live AND completed fixtures — the preview
    // is a frozen pre-kickoff document that persists so readers can set
    // it against the match analysis afterwards. Only fixtures that
    // never reach a kickoff state are excluded.
    if (fixture.data.status === 'postponed' || fixture.data.status === 'cancelled') return null;
    const home = teams.data.find((t) => t.id === homeTeamId);
    const away = teams.data.find((t) => t.id === awayTeamId);
    const hAgg = homeAgg.data;
    const aAgg = awayAgg.data;
    if (!home || !away || !hAgg || !aAgg) return null;
    if (hAgg.gamesPlayed === 0 || aAgg.gamesPlayed === 0) return null;

    return {
      summary: buildSummary(home, away, homeRank, awayRank, homeForm.outcomes, awayForm.outcomes),
      shape: buildShape(home, away, hAgg, aAgg),
      axes: buildPreviewAxes(home, away, hAgg, aAgg),
      danger: buildDanger(home, away, {
        homeScored: homeScored.data,
        awayScored: awayScored.data,
        homeConceded: homeConceded.data,
        awayConceded: awayConceded.data,
      }),
      keys: buildKeys(home, away, hAgg, aAgg),
      gaps: computeSignedGaps(hAgg, aAgg)
        .map((g) => ({ ...g, label: AXIS_LABELS[g.key] }))
        .sort((x, y) => Math.abs(y.norm) - Math.abs(x.norm)),
    };
  }, [
    fixture.data,
    teams.data,
    homeTeamId,
    awayTeamId,
    homeAgg.data,
    awayAgg.data,
    homeForm.outcomes,
    awayForm.outcomes,
    homeRank,
    awayRank,
    homeScored.data,
    awayScored.data,
    homeConceded.data,
    awayConceded.data,
  ]);

  return {
    data,
    isLoading: fixture.isLoading || teams.isLoading || homeAgg.isLoading || awayAgg.isLoading,
  };
}

// ─── Section builders ────────────────────────────────────────────────────────

function winsOf(outcomes: readonly FormOutcome[]): number {
  return outcomes.filter((o) => o === 'W').length;
}

function buildSummary(
  home: Team,
  away: Team,
  homeRank: number | null,
  awayRank: number | null,
  homeForm: readonly FormOutcome[],
  awayForm: readonly FormOutcome[],
): string {
  const parts: string[] = [];
  const hw = winsOf(homeForm);
  const aw = winsOf(awayForm);
  const hasForm = homeForm.length > 0 && awayForm.length > 0;

  if (homeRank != null && awayRank != null && homeRank !== awayRank) {
    const higher = homeRank < awayRank ? home : away;
    const lower = homeRank < awayRank ? away : home;
    const lowerWins = lower === home ? hw : aw;
    const hr = Math.min(homeRank, awayRank);
    const lr = Math.max(homeRank, awayRank);
    const gap = lr - hr;
    if (gap >= 8) {
      parts.push(
        `On paper, a mismatch: ${higher.name} sit ${ordinal(hr)} in the world, ${lower.name} down at ${ordinal(lr)}. The interesting question is whether the pitch agrees.`,
      );
      if (hasForm && lowerWins >= 3) {
        parts.push(
          `It might. ${lower.short_name} have quietly won ${lowerWins} of their last five, and that is exactly the kind of form gaps like this ignore at their peril.`,
        );
      } else if (hasForm) {
        parts.push(
          `${home.short_name} have won ${hw} of their last five, ${away.short_name} ${aw}.`,
        );
      }
      return parts.join(' ');
    }
    if (gap >= 3) {
      parts.push(
        `${higher.name} carry the higher billing at ${ordinal(hr)} in the world to ${ordinal(lr)}.`,
      );
      if (hasForm) {
        parts.push(
          hw === aw
            ? `Form refuses to pick a side: ${hw} wins from the last five apiece.`
            : `Recent form ${(hw > aw ? home : away) === higher ? 'backs the rankings up' : 'muddies it'}: ${home.short_name} have won ${hw} of five, ${away.short_name} ${aw}.`,
        );
      }
      return parts.join(' ');
    }
    parts.push(
      `${ordinal(hr)} against ${ordinal(lr)}, and barely a form line between them${hasForm ? ` at ${hw} and ${aw} wins from the last five` : ''}. Even on paper, even on habit. These are the fixtures that get decided by a single moment of control or panic.`,
    );
    return parts.join(' ');
  }

  if (hasForm) {
    parts.push(
      `${home.short_name} arrive having won ${hw} of their last five, ${away.short_name} ${aw}. The rankings offer no verdict here, so form is the only paper this match has.`,
    );
  }
  return parts.join(' ');
}

/**
 * "The shape of it" — a NUMBERS-FREE synthesis naming the likely
 * battlegrounds. The per-axis sections below carry the figures; this
 * section's job is the verdict, so it never repeats them (composition
 * guide §6: don't restate adjacent sections).
 */
function buildShape(home: Team, away: Team, h: TeamAggregate, a: TeamAggregate): string {
  // Coming-in backdrop opens the section (moved here from the match
  // analysis card 2026-07-06 — the kickoff baselines belong on the
  // pre-match surface; match analysis is strictly the match itself).
  const f1 = h.perGame.pointsScored.toFixed(1);
  const c1 = h.perGame.pointsConceded.toFixed(1);
  const f2 = a.perGame.pointsScored.toFixed(1);
  const c2 = a.perGame.pointsConceded.toFixed(1);
  const backdrop =
    `${home.short_name} come in scoring ${f1} a game and conceding ${c1}. ` +
    `${away.short_name} arrive at ${f2} for, ${c2} against.`;

  const gaps = computeSignedGaps(h, a)
    .filter((g) => Math.abs(g.norm) >= 0.5)
    .sort((x, y) => Math.abs(y.norm) - Math.abs(x.norm))
    .slice(0, 3);

  if (gaps.length === 0) {
    return `${backdrop} The profiles refuse to separate beyond that: nothing in the last ten matches picks a battleground. Fixtures like this get settled by execution, the first fifty-fifty refereeing call, and nerve.`;
  }

  const phrase = (g: SignedGap): string => {
    const lead = g.norm > 0 ? home : away;
    const trail = g.norm > 0 ? away : home;
    switch (g.key) {
      case 'attack': return `the pace of ${lead.short_name}'s attack`;
      case 'defence': return `whether ${trail.short_name} can score enough against the tournament's meaner defence`;
      case 'set-piece': return `a set-piece contest that leans ${lead.short_name}'s way`;
      case 'discipline': return `${trail.short_name}'s penalty habit`;
      case 'kicking': return `the kicking exchanges ${lead.short_name} usually win`;
      case 'aerial-delivered': return `${lead.short_name}'s contestable-kick game`;
      case 'aerial-received': return `${trail.short_name}'s security under the high ball`;
      case 'territory': return `${lead.short_name}'s habit of living in the right half of the pitch`;
      case 'possession': return `the fight for the ball itself`;
      case 'turnovers': return `the breakdown scraps`;
    }
  };

  const homeLeads = gaps.filter((g) => g.norm > 0).length;
  const verdict =
    homeLeads === gaps.length
      ? `${home.short_name} hold most of the levers going in.`
      : homeLeads === 0
        ? `${away.short_name} hold most of the levers going in.`
        : `The levers are split between the two sides, which is precisely what makes it a match.`;

  if (gaps.length === 1) {
    return `${backdrop} One battleground picks itself: ${phrase(gaps[0]!)}. ${verdict}`;
  }
  const names = gaps.map(phrase);
  return `${backdrop} ${gaps.length === 3 ? 'Three battlegrounds pick themselves' : 'Two battlegrounds pick themselves'}: ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}. ${verdict}`;
}

// ─── Per-axis coming-in comparison ──────────────────────────────────────────
// Repeatable rule set: every axis has ONE headline metric compared on
// fixed thresholds into three tiers — clear edge (full threshold),
// shades it (half), or even — with secondary metrics woven in for
// texture. Same taxonomy and order as the match analysis axes, so the
// pre-match read and the post-match read line up section for section.

/** Tier a gap against a threshold: 2 = clear, 1 = slight, 0 = even. */
function tierOf(gap: number, threshold: number): 0 | 1 | 2 {
  const a = Math.abs(gap);
  if (a >= threshold) return 2;
  if (a >= threshold / 2) return 1;
  return 0;
}

function buildPreviewAxes(home: Team, away: Team, h: TeamAggregate, a: TeamAggregate): PreviewAxis[] {
  const hg = h.perGame;
  const ag = a.perGame;
  // Positive gap = home better on that axis (inverted metrics flipped
  // before the comparison).
  const pick = (gap: number) => (gap > 0 ? home : away);
  const other = (gap: number) => (gap > 0 ? away : home);

  const axes: PreviewAxis[] = [];

  {
    // ATTACK — team-led, and a true collision read: the sharper attack
    // is set against what the OTHER side's defence has been conceding.
    const gap = hg.pointsScored - ag.pointsScored;
    const t = tierOf(gap, GAP_POINTS);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailG = lead === home ? ag : hg;
    axes.push({
      key: 'attack',
      label: 'Attack',
      narrative:
        t === 0
          ? `Neither attack arrives with a claim on this fixture: ${fmt(hg.pointsScored)} and ${fmt(ag.pointsScored)} points a game, near enough identical. The first defensive error may matter more than the first clean break.`
          : t === 1
            ? `${lead.short_name} shade the scoring habit at ${fmt(leadG.pointsScored)} a game to ${fmt(trailG.pointsScored)}. Not a gulf. But against a defence that has been conceding ${fmt(trailG.pointsConceded)}, small edges compound.`
            : `${lead.short_name} bring the fixture's heavyweight attack: ${fmt(leadG.pointsScored)} points a game with ${fmt(leadG.tries)} tries in it. ${trail.short_name} have been letting in ${fmt(trailG.pointsConceded)}. Something gives, and probably early.`,
    });
  }

  {
    // DEFENCE — dimension-led.
    const gap = ag.pointsConceded - hg.pointsConceded; // positive = home tighter
    const t = tierOf(gap, GAP_POINTS);
    const tight = pick(gap);
    const loose = other(gap);
    const tightG = tight === home ? hg : ag;
    const looseG = tight === home ? ag : hg;
    axes.push({
      key: 'defence',
      label: 'Defence',
      narrative:
        t === 0
          ? `Defence separates nobody here. ${fmt(hg.pointsConceded)} conceded a game plays ${fmt(ag.pointsConceded)}: two lines that have mostly held their shape.`
          : t === 1
            ? `The tighter line belongs to ${tight.short_name}, conceding ${fmt(tightG.pointsConceded)} a game on a ${Math.round(tightG.tackleSuccessPercent)}% tackle count. It is the kind of margin that shows up in the final quarter rather than the first.`
            : `Defensively this is lopsided. ${tight.short_name} give up ${fmt(tightG.pointsConceded)} a game; ${loose.short_name} have been leaking ${fmt(looseG.pointsConceded)}. If that gap survives contact with the weekend, the scoreboard will say so.`,
    });
  }

  {
    // SET-PIECE — carries the watch-this flag.
    const hSet = (hg.scrumSuccessPercent + hg.lineoutSuccessPercent) / 2;
    const aSet = (ag.scrumSuccessPercent + ag.lineoutSuccessPercent) / 2;
    const gap = hSet - aSet;
    const t = tierOf(gap, GAP_SET_PIECE);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailSet = Math.round(Math.min(hSet, aSet));
    axes.push({
      key: 'set-piece',
      label: 'Set-piece',
      narrative:
        t === 0
          ? `Two dependable platforms, ${Math.round(hSet)}% and ${Math.round(aSet)}% combined scrum and lineout. Clean ball for both, so the contest moves elsewhere.`
          : t === 1
            ? `${lead.short_name} hold the steadier platform, ${Math.round(Math.max(hSet, aSet))}% combined set-piece to ${trailSet}%. Watch the first scrum: it will tell you whether that margin is real on the day.`
            : `The set-piece is ${lead.short_name}'s to weaponise. Scrum at ${Math.round(leadG.scrumSuccessPercent)}%, lineout at ${Math.round(leadG.lineoutSuccessPercent)}%, against a platform running ${trailSet}% combined. Every ${trail.short_name} feed under pressure becomes a coin-flip for possession.`,
    });
  }

  {
    // DISCIPLINE — finding-led.
    const gap = ag.penaltiesConceded - hg.penaltiesConceded; // positive = home cleaner
    const t = tierOf(gap, GAP_DISCIPLINE);
    const clean = pick(gap);
    const loose = other(gap);
    const cleanVal = Math.min(hg.penaltiesConceded, ag.penaltiesConceded);
    const looseVal = Math.max(hg.penaltiesConceded, ag.penaltiesConceded);
    axes.push({
      key: 'discipline',
      label: 'Discipline',
      narrative:
        t === 0
          ? `No free points on offer from the whistle: ${fmt(hg.penaltiesConceded)} and ${fmt(ag.penaltiesConceded)} penalties a game, both respectable numbers at this level.`
          : t === 1
            ? `The penalty ledger leans against ${loose.short_name}, ${fmt(looseVal)} a game to ${fmt(cleanVal)}. A small margin, but tight Tests are decided from the tee.`
            : `Discipline is the crack in ${loose.short_name}'s profile: ${fmt(looseVal)} penalties a game while ${clean.short_name} give up just ${fmt(cleanVal)}. That differential is territory, and territory becomes points.`,
    });
  }

  {
    // KICKING — finding-led, consequence framed as field position.
    const gap = hg.kickMeters - ag.kickMeters;
    const t = tierOf(gap / Math.max(1, ag.kickMeters), 0.15);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailG = lead === home ? ag : hg;
    axes.push({
      key: 'kicking',
      label: 'Kicking',
      narrative:
        t === 0
          ? `Expect an even aerial contest: ${Math.round(hg.kicksInPlay)} and ${Math.round(ag.kicksInPlay)} kicks in play a game, and neither side hides from the exchange.`
          : t === 1
            ? `${lead.short_name} put slightly more boot on the game, ${Math.round(leadG.kickMeters)} kick metres a match. Marginal, but field position compounds over eighty minutes.`
            : `${lead.short_name} will look to play this one in the air: ${Math.round(leadG.kickMeters)} kick metres a game against ${Math.round(trailG.kickMeters)} coming back. If ${trail.short_name} cannot win the contestables, they spend the afternoon exiting.`,
    });
  }

  {
    // TERRITORY — dimension-led.
    const gap = hg.territoryPercent - ag.territoryPercent;
    const t = tierOf(gap, GAP_SHARE);
    const lead = pick(gap);
    const trail = other(gap);
    const leadVal = Math.round(Math.max(hg.territoryPercent, ag.territoryPercent));
    axes.push({
      key: 'territory',
      label: 'Territory',
      narrative:
        t === 0
          ? `Territory splits down the middle by habit, ${Math.round(hg.territoryPercent)}% and ${Math.round(ag.territoryPercent)}%. Neither side is used to living in its own half, so someone's routine breaks today.`
          : t === 1
            ? `${lead.short_name} tend to play on the right side of halfway, a ${leadVal}% territory habit. Pressure follows position.`
            : `Territory runs heavily to ${lead.short_name} at ${leadVal}% across the window. ${trail.short_name}'s exits will be examined all afternoon, and at this level a botched clearance is three points.`,
    });
  }

  {
    // POSSESSION — team-led, contradiction pattern on the clear tier.
    const gap = hg.possessionPercent - ag.possessionPercent;
    const t = tierOf(gap, GAP_SHARE);
    const lead = pick(gap);
    const trail = other(gap);
    const leadVal = Math.round(Math.max(hg.possessionPercent, ag.possessionPercent));
    const leadG = lead === home ? hg : ag;
    axes.push({
      key: 'possession',
      label: 'Possession',
      narrative:
        t === 0
          ? `The ball will be shared: ${Math.round(hg.possessionPercent)}% to ${Math.round(ag.possessionPercent)}% possession on habit. Whoever breaks that pattern first changes the match.`
          : t === 1
            ? `${lead.short_name} typically see more of the ball at ${leadVal}%. Not dominance, but enough to set the rhythm if they keep it.`
            : `${lead.short_name} hoard the ball, ${leadVal}% of it on average. The catch: hoarding only matters if the points follow (${fmt(leadG.pointsScored)} a game says they mostly do), and ${trail.short_name} will bet on their defence outlasting the phases.`,
    });
  }

  {
    // TURNOVERS — finding-led.
    const hNet = hg.turnoversWon - hg.turnoversConceded;
    const aNet = ag.turnoversWon - ag.turnoversConceded;
    const gap = hNet - aNet;
    const t = tierOf(gap, GAP_TURNOVERS);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailG = lead === home ? ag : hg;
    axes.push({
      key: 'turnovers',
      label: 'Turnovers',
      narrative:
        t === 0
          ? `Loose ball should be a fair fight: net ${fmt(hNet)} a game against net ${fmt(aNet)}. The breakdown referees itself when it is this even.`
          : t === 1
            ? `The breakdown scraps lean ${lead.short_name}'s way at plus-${fmt(Math.abs(lead === home ? hNet : aNet))} a game. Fine margins, but turnovers have a habit of arriving at the worst possible moments.`
            : `The breakdown is ${lead.short_name}'s hunting ground: ${fmt(leadG.turnoversWon)} turnovers won a game while ${trail.short_name} cough up ${fmt(trailG.turnoversConceded)}. Every loose ruck is a transition threat, and both benches know it.`,
    });
  }

  {
    // AERIAL (DELIVERED) — the kicking side of the contest: when a
    // team puts the ball up, does it come back?
    const gap = hg.deliveredWonPercent - ag.deliveredWonPercent;
    const t = tierOf(gap, GAP_AERIAL);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailG = lead === home ? ag : hg;
    axes.push({
      key: 'aerial-delivered',
      label: 'Aerial (kicked)',
      narrative:
        t === 0
          ? `Neither side owns its own bombs: ${Math.round(hg.deliveredWonPercent)}% and ${Math.round(ag.deliveredWonPercent)}% of contestables regathered. Kicking to compete is a coin-flip here, which usually means less of it.`
          : t === 1
            ? `${lead.short_name} get slightly more back from the boot, regathering ${Math.round(leadG.deliveredWonPercent)}% of their contestables to ${Math.round(trailG.deliveredWonPercent)}%. Enough to keep bombing; not enough to build a game on.`
            : `The contestable kick is a genuine ${lead.short_name} weapon: ${Math.round(leadG.deliveredWonPercent)}% of their own bombs come back against ${trail.short_name}'s ${Math.round(trailG.deliveredWonPercent)}%. Expect the ball in the air early and often.`,
    });
  }

  {
    // AERIAL (RECEIVED) — the back-field side: when the ball comes
    // down on you, do you secure it?
    const gap = hg.receivedWonPercent - ag.receivedWonPercent;
    const t = tierOf(gap, GAP_AERIAL);
    const lead = pick(gap);
    const trail = other(gap);
    const leadG = lead === home ? hg : ag;
    const trailG = lead === home ? ag : hg;
    axes.push({
      key: 'aerial-received',
      label: 'Aerial (received)',
      narrative:
        t === 0
          ? `Both back fields hold up under the high ball, securing ${Math.round(hg.receivedWonPercent)}% and ${Math.round(ag.receivedWonPercent)}% of what comes down on them. Kicking at either is donating possession.`
          : t === 1
            ? `${lead.short_name}'s back field is the calmer one, securing ${Math.round(leadG.receivedWonPercent)}% of received contestables to ${Math.round(trailG.receivedWonPercent)}%. A modest edge that decides a handful of fifty-fifties.`
            : `There is a soft spot under the high ball: ${trail.short_name} secure only ${Math.round(trailG.receivedWonPercent)}% of received contestables while ${lead.short_name} claim ${Math.round(leadG.receivedWonPercent)}%. ${lead.short_name}'s exit strategy writes itself.`,
    });
  }

  return axes;
}

const QUARTER_LABELS = ['first quarter', 'second quarter', 'third quarter', 'final quarter'] as const;

function skewOf(pattern: TeamPointsPattern | undefined): { quarter: number; pct: number } | null {
  if (!pattern || pattern.gamesUsed === 0) return null;
  let q = 0;
  for (let i = 1; i < 4; i++) {
    if (pattern.avgPercentByQuarter[i]! > pattern.avgPercentByQuarter[q]!) q = i;
  }
  const pct = Math.round(pattern.avgPercentByQuarter[q]!);
  return pct >= TIMING_SKEW ? { quarter: q, pct } : null;
}

function buildDanger(
  home: Team,
  away: Team,
  p: {
    homeScored: TeamPointsPattern | undefined;
    awayScored: TeamPointsPattern | undefined;
    homeConceded: TeamPointsPattern | undefined;
    awayConceded: TeamPointsPattern | undefined;
  },
): string | null {
  const parts: string[] = [];

  // Direct collisions first: one side scores heavily in the same
  // quarter the other leaks in. That overlap is the section's reason
  // to exist.
  const hs = skewOf(p.homeScored);
  const ac = skewOf(p.awayConceded);
  if (hs && ac && hs.quarter === ac.quarter) {
    parts.push(
      `The ${QUARTER_LABELS[hs.quarter]} is the fault line. ${home.short_name} score ${hs.pct}% of their points there, and it is exactly where ${away.short_name} bleed (${ac.pct}% of everything they concede). Whoever owns that window owns the pattern of the match.`,
    );
  }
  const as_ = skewOf(p.awayScored);
  const hc = skewOf(p.homeConceded);
  if (as_ && hc && as_.quarter === hc.quarter) {
    parts.push(
      `It cuts both ways: ${as_.pct}% of ${away.short_name}'s scoring lands in the ${QUARTER_LABELS[as_.quarter]}, ${home.short_name}'s own softest period. Expect both benches to be emptied with that window in mind.`,
    );
  }

  // No collision: a lone strong skew is still a viewing instruction.
  if (parts.length === 0) {
    if (hs) {
      parts.push(
        `${home.short_name} do their damage by appointment: ${hs.pct}% of their points arrive in the ${QUARTER_LABELS[hs.quarter]}. ${away.short_name} know exactly when the storm comes; surviving it is another matter.`,
      );
    }
    if (as_) {
      parts.push(
        `${away.short_name} load ${as_.pct}% of their scoring into the ${QUARTER_LABELS[as_.quarter]}, so the match's rhythm has a timetable.`,
      );
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Signed, threshold-normalised gap per axis (positive = `h` better) —
 * the shared engine behind Keys to the match. |norm| ≥ 1 is a clear
 * edge, ≥ 0.5 shades it, below that the axis reads even.
 */
interface SignedGap {
  key: PreviewAxisKey;
  norm: number;
}

function computeSignedGaps(h: TeamAggregate, a: TeamAggregate): SignedGap[] {
  const hg = h.perGame;
  const ag = a.perGame;
  const hSet = (hg.scrumSuccessPercent + hg.lineoutSuccessPercent) / 2;
  const aSet = (ag.scrumSuccessPercent + ag.lineoutSuccessPercent) / 2;
  return [
    { key: 'attack', norm: (hg.pointsScored - ag.pointsScored) / GAP_POINTS },
    { key: 'defence', norm: (ag.pointsConceded - hg.pointsConceded) / GAP_POINTS },
    { key: 'set-piece', norm: (hSet - aSet) / GAP_SET_PIECE },
    { key: 'discipline', norm: (ag.penaltiesConceded - hg.penaltiesConceded) / GAP_DISCIPLINE },
    {
      key: 'kicking',
      norm: (hg.kickMeters - ag.kickMeters) / Math.max(1, ag.kickMeters) / 0.15,
    },
    { key: 'territory', norm: (hg.territoryPercent - ag.territoryPercent) / GAP_SHARE },
    { key: 'possession', norm: (hg.possessionPercent - ag.possessionPercent) / GAP_SHARE },
    {
      key: 'turnovers',
      norm:
        (hg.turnoversWon - hg.turnoversConceded - (ag.turnoversWon - ag.turnoversConceded)) /
        GAP_TURNOVERS,
    },
    {
      key: 'aerial-delivered',
      norm: (hg.deliveredWonPercent - ag.deliveredWonPercent) / GAP_AERIAL,
    },
    {
      key: 'aerial-received',
      norm: (hg.receivedWonPercent - ag.receivedWonPercent) / GAP_AERIAL,
    },
  ];
}

/**
 * One key per side, ALWAYS derived from the data — each side gets
 * either its biggest weapon to press (exploit) or its worst deficit to
 * survive (neutralise), whichever gap is larger from its perspective.
 * When both sides' keys land on the same battleground they get the two
 * complementary framings of it, which is the point: one side's key IS
 * the other side's problem. In a genuine dead-heat the LARGEST gap is
 * still used, framed as the fine margin — never generic filler.
 */
function buildKeys(home: Team, away: Team, h: TeamAggregate, a: TeamAggregate): string {
  const gaps = computeSignedGaps(h, a).sort((x, y) => Math.abs(y.norm) - Math.abs(x.norm));
  const top = gaps[0]!;

  const keyText = (side: Team, opp: Team, g: SignedGap, sideIsHome: boolean): string => {
    const advantage = sideIsHome ? g.norm > 0 : g.norm < 0;
    const sg = sideIsHome ? h.perGame : a.perGame;
    const og = sideIsHome ? a.perGame : h.perGame;
    return advantage ? exploitText(g.key, opp, sg, og) : neutraliseText(g.key, opp, sg, og);
  };

  // Each side keys off the top gap FROM ITS PERSPECTIVE: the side ahead
  // presses it, the side behind survives it. If the second-ranked gap
  // is nearly as big and favours the trailing side, that side keys off
  // its own weapon instead — two different battlegrounds beats two
  // views of one.
  let homeGap = top;
  let awayGap = top;
  const second = gaps[1];
  if (second && Math.abs(second.norm) >= Math.abs(top.norm) * 0.7) {
    const topFavoursHome = top.norm > 0;
    const secondFavoursHome = second.norm > 0;
    if (topFavoursHome && !secondFavoursHome) awayGap = second;
    if (!topFavoursHome && secondFavoursHome) homeGap = second;
  }

  const isDeadHeat = Math.abs(top.norm) < 0.5;
  const prefix = isDeadHeat
    ? `Nothing separates these profiles by much, so the finest margin available is the one to own. `
    : '';
  return `${prefix}For ${home.short_name}: ${keyText(home, away, homeGap, true)}. For ${away.short_name}: ${keyText(away, home, awayGap, false)}.`;
}

type PerGame = TeamAggregate['perGame'];

/** The side holding the edge on this axis: how to press it. */
function exploitText(axis: PreviewAxisKey, opp: Team, s: PerGame, o: PerGame): string {
  switch (axis) {
    case 'attack':
      return `keep the tempo high. A ${fmt(s.pointsScored)}-points-a-game attack meeting a defence that concedes ${fmt(o.pointsConceded)} is the fixture's biggest weapon, and it blunts if the game slows`;
    case 'defence':
      return `make this a grind. Conceding just ${fmt(s.pointsConceded)} a game, they can drag ${opp.short_name} into exactly the low-scoring contest ${opp.short_name} cannot afford`;
    case 'set-piece':
      return `squeeze the ${opp.short_name} set-piece from the first whistle: a ${Math.round((o.scrumSuccessPercent + o.lineoutSuccessPercent) / 2)}% combined platform creaks under sustained pressure, and creaking platforms give up penalties`;
    case 'discipline':
      return `keep the penalty count lopsided. ${opp.short_name} concede ${fmt(o.penaltiesConceded)} a game, so live in their half and let the referee move the scoreboard`;
    case 'kicking':
      return `own the air: ${Math.round(s.kickMeters)} kick metres a game wins the field-position war before the defence is ever asked a question`;
    case 'territory':
      return `pin ${opp.short_name} deep early. A ${Math.round(s.territoryPercent)}% territory habit turns into points against a side forced to exit all afternoon`;
    case 'possession':
      return `starve ${opp.short_name} of the ball. At ${Math.round(s.possessionPercent)}% average possession the opposition tackles for long stretches, and tired tacklers give away penalties`;
    case 'turnovers':
      return `hunt the breakdown: a net plus-${fmt(s.turnoversWon - s.turnoversConceded)} turnover game is free possession against a side that coughs it up ${fmt(o.turnoversConceded)} times a match`;
    case 'aerial-delivered':
      return `put the ball in the air: regathering ${Math.round(s.deliveredWonPercent)}% of their own contestables against a back field securing only ${Math.round(o.receivedWonPercent)}% is repeatable free possession`;
    case 'aerial-received':
      return `invite the bombs and keep them: a ${Math.round(s.receivedWonPercent)}% security rate under the high ball turns ${opp.short_name}'s kicking game into a hand-back`;
  }
}

/** The side behind on this axis: the survival job. */
function neutraliseText(axis: PreviewAxisKey, opp: Team, s: PerGame, o: PerGame): string {
  switch (axis) {
    case 'attack':
      return `slow everything down. Quick ball feeds a ${opp.short_name} attack scoring ${fmt(o.pointsScored)} a game, so kill the ruck speed and make them play from deep`;
    case 'defence':
      return `fix the leaks first: ${fmt(s.pointsConceded)} conceded a game is a losing formula against any Test attack, let alone this one`;
    case 'set-piece':
      return `get their own ball through the day. A ${Math.round((s.scrumSuccessPercent + s.lineoutSuccessPercent) / 2)}% set-piece against this pack makes every scrum and lineout a pressure event`;
    case 'discipline':
      return `cut the penalty count: ${fmt(s.penaltiesConceded)} a game hands ${opp.short_name} exactly the territory game they want to play`;
    case 'kicking':
      return `refuse the kicking duel. They lose ${Math.round(o.kickMeters - s.kickMeters)} metres a game in the air, so keep ball in hand and turn it into a running contest`;
    case 'territory':
      return `win the exit battle. ${opp.short_name} live in the opposition half (${Math.round(o.territoryPercent)}% of the time), and every botched clearance is three points at this level`;
    case 'possession':
      return `make every tackle count and force the turnover: ${Math.round(o.possessionPercent)}% ${opp.short_name} possession means living off scraps, so each scrap has to become something`;
    case 'turnovers':
      return `protect the ruck. A net ${fmt(s.turnoversWon - s.turnoversConceded)} turnover game feeds a side that scores off loose ball, and this opposition scores off loose ball`;
    case 'aerial-delivered':
      return `stop kicking away cheap ball: regathering only ${Math.round(s.deliveredWonPercent)}% of their own contestables, every hopeful bomb is a possession handed to ${opp.short_name}`;
    case 'aerial-received':
      return `fix the back field first. Securing just ${Math.round(s.receivedWonPercent)}% under the high ball is an invitation ${opp.short_name} will RSVP to all afternoon`;
  }
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
