import { useMemo } from 'react';

import type { PlayerMatchStats } from '@rugby-app/shared';

import { usePlayer, usePlayerPercentiles } from '@/api/hooks';
import { usePlayerAggregate } from '@/hooks/use-player-aggregate';
import { usePlayerMatchHistory } from '@/hooks/use-player-match-stats';
import {
  BACK_SCOUT,
  BACK_TREND,
  FORWARD_POSITIONS,
  FORWARD_SCOUT,
  FORWARD_TREND,
  GROUP_LABELS,
  PLAYER_LOOKBACK,
  POSITION_LABELS,
  type ScoutMetric,
} from '@/lib/player-roles';

/**
 * TODO(phase-6): this is the client-side TEMPLATE implementation of the
 * player-analysis narrative. Like `useMatchAnalysis`, it is replaced at
 * Phase 6 by server-side LLM inference whose system prompt is
 * `docs/analysis-narrative-spec.md` ("Player analysis" section). Keep
 * structure, tone, and thresholds in lockstep with that doc.
 */

// Percentile thresholds for calling a dimension a strength / soft spot.
const STRENGTH_PCT = 70;
const WEAKNESS_PCT = 30;
// Recent-vs-prior form delta that qualifies as a real move.
const FORM_DELTA = 0.15;
// Minimum appearances before halves-comparison form reads are offered.
const MIN_FORM_APPS = 6;

export interface PlayerAnalysis {
  /** Unlabeled cold-open sentence, mirrors the match card's summary. */
  summary: string;
  /** Percentile profile vs positional peers. */
  scouting: string;
  /** Recent-window trajectory read. */
  form: string;
  /** "Season" — the record card in prose: appearances, role, minutes,
   *  scoreboard contribution. */
  season: string;
  /** Closing outlook, mirrors the match card's "Going forward". */
  outlook: string;
}

interface UsePlayerAnalysisResult {
  data: PlayerAnalysis | undefined;
  isLoading: boolean;
}

interface RatedMetric extends ScoutMetric {
  /** Presentation percentile — inverted metrics already flipped, so
   *  higher is always better. */
  display: number;
  per80: number;
}

export function usePlayerAnalysis(playerId: string): UsePlayerAnalysisResult {
  const player = usePlayer(playerId);
  const percentiles = usePlayerPercentiles(playerId, PLAYER_LOOKBACK);
  const aggregate = usePlayerAggregate(playerId);
  const history = usePlayerMatchHistory(playerId);

  const data = useMemo<PlayerAnalysis | undefined>(() => {
    const p = player.data;
    const pct = percentiles.data;
    const agg = aggregate.data;
    const sheets = history.data;
    if (!p || !pct || !agg || !sheets) return undefined;
    if (agg.appearances === 0) return undefined;

    const surname = p.name.split(' ').slice(-1)[0] ?? p.name;
    const isForward = FORWARD_POSITIONS.includes(p.primary_position);
    const scoutSet = isForward ? FORWARD_SCOUT : BACK_SCOUT;
    const groupLabel = GROUP_LABELS[pct.position_group] ?? 'positional peers';

    const byField = new Map(pct.metrics.map((m) => [m.field, m]));
    const rated: RatedMetric[] = [];
    for (const m of scoutSet) {
      const row = byField.get(m.field);
      if (!row) continue;
      rated.push({
        ...m,
        display: m.inverted ? 100 - row.percentile : row.percentile,
        per80: row.per80,
      });
    }
    rated.sort((a, b) => b.display - a.display);

    const strengths = rated.filter((r) => r.display >= STRENGTH_PCT).slice(0, 2);
    const weakest = rated.length > 0 ? rated[rated.length - 1] : undefined;
    const softSpot = weakest && weakest.display <= WEAKNESS_PCT ? weakest : undefined;

    return {
      summary: buildSummary(p.name, surname, POSITION_LABELS[p.primary_position], p.cap_count, agg),
      scouting: buildScouting(surname, groupLabel, pct.peers, strengths, softSpot, rated, agg.totals),
      form: buildForm(surname, isForward, sheets),
      season: buildSeason(surname, agg),
      outlook: buildOutlook(surname, strengths, softSpot),
    };
  }, [player.data, percentiles.data, aggregate.data, history.data]);

  return {
    data,
    isLoading:
      player.isLoading || percentiles.isLoading || aggregate.isLoading || history.isLoading,
  };
}

// ─── Section builders ────────────────────────────────────────────────────────

function buildSummary(
  name: string,
  surname: string,
  positionLabel: string,
  caps: number,
  agg: { appearances: number; starts: number; minutesTotal: number; totals: { points: number; tries: number } },
): string {
  const starts = agg.starts === agg.appearances
    ? 'all of them starts'
    : `${agg.starts} of them starts`;
  const scoring =
    agg.totals.points > 0
      ? ` ${surname}'s scoreboard contribution stands at ${agg.totals.points} points${agg.totals.tries > 0 ? `, ${agg.totals.tries} ${agg.totals.tries === 1 ? 'try' : 'tries'} among them` : ''}.`
      : '';
  return `${name} is a ${positionLabel.toLowerCase()} with ${caps} caps, and the current window shows ${agg.appearances} ${agg.appearances === 1 ? 'appearance' : 'appearances'} (${starts}) for ${agg.minutesTotal} minutes.${scoring}`;
}

function buildScouting(
  surname: string,
  groupLabel: string,
  peers: number,
  strengths: RatedMetric[],
  softSpot: RatedMetric | undefined,
  rated: RatedMetric[],
  totals: { yellow_cards: number; red_cards: number },
): string {
  const parts: string[] = [];
  if (strengths.length > 0) {
    const lead = strengths[0];
    parts.push(
      `Set against ${peers} ${groupLabel} on per-80 rates, ${surname}'s clearest weapon is ${lead.label.toLowerCase()}.`,
    );
    parts.push(
      `That line runs at ${formatRate(lead.per80)} per 80, ${ordinal(lead.display)}-percentile territory in this group.`,
    );
    if (strengths.length > 1) {
      const second = strengths[1];
      parts.push(`Behind it, ${second.label.toLowerCase()} holds the ${ordinal(second.display)} percentile.`);
    }
  } else {
    parts.push(
      `Set against ${peers} ${groupLabel} on per-80 rates, ${surname} profiles as balanced rather than spiky; no dimension pulls far enough clear of the peer median to call a weapon.`,
    );
  }
  if (softSpot) {
    parts.push(
      `The soft spot is ${softSpot.label.toLowerCase()}, down in the ${ordinal(softSpot.display)} percentile of the group: the one line on this sheet an opposition analyst would circle.`,
    );
  } else if (rated.length > 0 && strengths.length > 0) {
    parts.push('There is no genuine soft spot to report; the floor holds across every scouted dimension.');
  }
  // Card count — the Stats pane's discipline row surfaced whenever it
  // is non-zero. A sin-binned player's profile should say so.
  const { yellow_cards: yc, red_cards: rc } = totals;
  if (rc > 0) {
    parts.push(
      `The disciplinary record needs attention: ${rc} red ${rc === 1 ? 'card' : 'cards'}${yc > 0 ? ` and ${yc} yellow` : ''} in the window.`,
    );
  } else if (yc > 0) {
    parts.push(
      `The window's sheet also carries ${yc} yellow ${yc === 1 ? 'card' : 'cards'}.`,
    );
  }
  return parts.join(' ');
}

function buildForm(
  surname: string,
  isForward: boolean,
  sheets: readonly PlayerMatchStats[],
): string {
  // Server order is kickoff DESC — newest first.
  const apps = sheets.filter((s) => s.minutes_played > 0).slice(0, PLAYER_LOOKBACK);
  if (apps.length < MIN_FORM_APPS) {
    return `A trend read needs a deeper sample than ${apps.length} ${apps.length === 1 ? 'appearance' : 'appearances'}, so the halves comparison stays parked; the scouting profile above is the more reliable guide for now.`;
  }

  const half = Math.floor(apps.length / 2);
  const recent = apps.slice(0, half);
  const prior = apps.slice(half);

  // ALL the role's Preview trend metrics, not just one — the same three
  // sparklines the Preview tab draws, reduced to rise/dip/held reads.
  const trendSet = isForward ? FORWARD_TREND : BACK_TREND;
  const reads = trendSet.map((m) => {
    const recentAvg = avg(recent.map((s) => s[m.field]));
    const priorAvg = avg(prior.map((s) => s[m.field]));
    const word = trendWord(recentAvg, priorAvg);
    const label = m.label.toLowerCase();
    if (word === 'held') return `${label} holding steady`;
    return `${label} ${word === 'up' ? 'rising' : 'dipping'} (${formatRate(priorAvg)} to ${formatRate(recentAvg)} per game)`;
  });
  const trendSentence = `Split the last ${apps.length} matches played into recent and earlier halves and the trend lines are plain: ${listJoin(reads)}.`;

  const minRecent = avg(recent.map((s) => s.minutes_played));
  const minPrior = avg(prior.map((s) => s.minutes_played));
  const minRead = trendWord(minRecent, minPrior);

  const minSentence =
    minRead === 'held'
      ? `Minutes have held steady at around ${Math.round(minRecent)} an outing.`
      : minRead === 'up'
        ? `${surname}'s minutes have climbed from ${Math.round(minPrior)} to ${Math.round(minRecent)} an outing, and growing minutes are the plainest read there is on selection trust.`
        : `${surname}'s minutes have slipped from ${Math.round(minPrior)} to ${Math.round(minRecent)} an outing; as a read on selection trust, that is the line to watch.`;

  return `${trendSentence} ${minSentence}`;
}

function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** "Season" — the record card in prose: role, volume, contribution. */
function buildSeason(
  surname: string,
  agg: { appearances: number; starts: number; minutesTotal: number; totals: Record<string, number> },
): string {
  const apps = agg.appearances;
  const starts = agg.starts;
  const minutes = agg.minutesTotal;
  const role =
    starts === apps
      ? 'every one a start'
      : starts === 0
        ? 'all of them off the bench'
        : `${starts} of them starts`;
  const avgMin = apps > 0 ? Math.round(minutes / apps) : 0;
  const pts = agg.totals.points ?? 0;
  const tries = agg.totals.tries ?? 0;
  const contribution =
    pts > 0
      ? `The scoreboard contribution has been ${pts} points${tries > 0 ? ` (${tries} ${tries === 1 ? 'try' : 'tries'})` : ''}.`
      : `The contribution has lived away from the scoresheet — graft rather than glory, which the profile above prices in.`;
  const shift =
    avgMin >= 70
      ? `an eighty-minute player in all but name`
      : avgMin >= 55
        ? `a full-shift starter by workload`
        : `used in bursts rather than full shifts`;
  return `${surname} has ${apps} ${apps === 1 ? 'appearance' : 'appearances'} in the window, ${role}, averaging ${avgMin} minutes — ${shift}. ${contribution}`;
}

function buildOutlook(
  surname: string,
  strengths: RatedMetric[],
  softSpot: RatedMetric | undefined,
): string {
  if (softSpot && strengths.length > 0) {
    return `The next gain is clearly signposted: with the ${strengths[0].label.toLowerCase()} platform already established, lifting the ${softSpot.label.toLowerCase()} numbers is where a rounder profile comes from.`;
  }
  if (softSpot) {
    return `The ${softSpot.label.toLowerCase()} numbers are the place to start. Movement there changes the shape of the whole profile.`;
  }
  return `Consolidation, not repair, is the brief for ${surname}: the level is set, and holding it across a longer run of matches is what turns a good window into a reputation.`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function trendWord(recent: number, prior: number): 'up' | 'down' | 'held' {
  if (prior <= 0) return recent > 0 ? 'up' : 'held';
  const delta = (recent - prior) / prior;
  if (delta >= FORM_DELTA) return 'up';
  if (delta <= -FORM_DELTA) return 'down';
  return 'held';
}

function avg(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

function formatRate(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
