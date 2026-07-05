import { useMemo } from 'react';

import { usePlayer, usePlayerPercentiles } from '@/api/hooks';
import { usePlayerAggregate } from '@/hooks/use-player-aggregate';
import { usePlayerMatchHistory } from '@/hooks/use-player-match-stats';
import {
  BACK_SCOUT,
  FORWARD_POSITIONS,
  FORWARD_SCOUT,
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
      scouting: buildScouting(surname, groupLabel, pct.peers, strengths, softSpot, rated),
      form: buildForm(surname, isForward, sheets),
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
      ? ` ${surname} has contributed ${agg.totals.points} points${agg.totals.tries > 0 ? `, including ${agg.totals.tries} ${agg.totals.tries === 1 ? 'try' : 'tries'}` : ''}.`
      : '';
  return `${name} is a ${positionLabel.toLowerCase()} with ${caps} caps, logging ${agg.appearances} ${agg.appearances === 1 ? 'appearance' : 'appearances'} (${starts}) and ${agg.minutesTotal} minutes across the current window.${scoring}`;
}

function buildScouting(
  surname: string,
  groupLabel: string,
  peers: number,
  strengths: RatedMetric[],
  softSpot: RatedMetric | undefined,
  rated: RatedMetric[],
): string {
  const parts: string[] = [];
  if (strengths.length > 0) {
    const lead = strengths[0];
    let s = `Measured against ${peers} ${groupLabel} on per-80 rates, ${surname}'s ${lead.label.toLowerCase()} sit in the ${ordinal(lead.display)} percentile (${formatRate(lead.per80)} per 80)`;
    if (strengths.length > 1) {
      const second = strengths[1];
      s += `, with ${second.label.toLowerCase()} not far behind at the ${ordinal(second.display)}`;
    }
    s += '.';
    parts.push(s);
  } else {
    parts.push(
      `Measured against ${peers} ${groupLabel} on per-80 rates, the profile is broadly balanced: no dimension strays far above the peer median.`,
    );
  }
  if (softSpot) {
    parts.push(
      `The soft spot is ${softSpot.label.toLowerCase()}, down in the ${ordinal(softSpot.display)} percentile of the peer group.`,
    );
  } else if (rated.length > 0 && strengths.length > 0) {
    parts.push('There is no glaring weakness in the profile; the floor holds across every scouted dimension.');
  }
  return parts.join(' ');
}

function buildForm(
  surname: string,
  isForward: boolean,
  sheets: readonly {
    minutes_played: number;
    tackles_made: number;
    metres_carried: number;
  }[],
): string {
  // Server order is kickoff DESC — newest first.
  const apps = sheets.filter((s) => s.minutes_played > 0).slice(0, PLAYER_LOOKBACK);
  if (apps.length < MIN_FORM_APPS) {
    return `With only ${apps.length} ${apps.length === 1 ? 'appearance' : 'appearances'} in the sample, trend reads are thin; the profile above is the more reliable guide for now.`;
  }

  const half = Math.floor(apps.length / 2);
  const recent = apps.slice(0, half);
  const prior = apps.slice(half);

  const keyLabel = isForward ? 'tackle count' : 'carry metres';
  const keyOf = (s: (typeof apps)[number]) => (isForward ? s.tackles_made : s.metres_carried);
  const keyRecent = avg(recent.map(keyOf));
  const keyPrior = avg(prior.map(keyOf));
  const keyRead = trendWord(keyRecent, keyPrior);

  const minRecent = avg(recent.map((s) => s.minutes_played));
  const minPrior = avg(prior.map((s) => s.minutes_played));
  const minRead = trendWord(minRecent, minPrior);

  const keySentence =
    keyRead === 'held'
      ? `Across the last ${apps.length} matches played, ${surname}'s ${keyLabel} has held steady (${formatRate(keyRecent)} per game recently against ${formatRate(keyPrior)} across the earlier stretch).`
      : `Across the last ${apps.length} matches played, ${surname}'s ${keyLabel} has ${keyRead === 'up' ? 'risen' : 'dipped'} from ${formatRate(keyPrior)} to ${formatRate(keyRecent)} per game.`;

  const minSentence =
    minRead === 'held'
      ? `Minutes have stayed consistent at around ${Math.round(minRecent)} per outing.`
      : minRead === 'up'
        ? `Minutes have climbed from ${Math.round(minPrior)} to ${Math.round(minRecent)} per outing, a read on growing selection trust.`
        : `Minutes have slipped from ${Math.round(minPrior)} to ${Math.round(minRecent)} per outing, worth watching over the next squad naming.`;

  return `${keySentence} ${minSentence}`;
}

function buildOutlook(
  surname: string,
  strengths: RatedMetric[],
  softSpot: RatedMetric | undefined,
): string {
  if (softSpot && strengths.length > 0) {
    return `Going forward, lifting the ${softSpot.label.toLowerCase()} numbers is the clearest route to a rounder profile; the ${strengths[0].label.toLowerCase()} platform is already in place.`;
  }
  if (softSpot) {
    return `Going forward, the ${softSpot.label.toLowerCase()} numbers are the obvious place to start; a lift there changes the shape of the whole profile.`;
  }
  return `Going forward, the task for ${surname} is consolidation rather than repair: holding this level across a longer run of matches is what turns a good window into a reputation.`;
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
