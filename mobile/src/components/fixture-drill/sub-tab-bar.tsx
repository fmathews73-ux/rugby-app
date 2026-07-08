import { SegmentedTabs } from '@/components/segmented-tabs';

/** Fixture stats categories as SIBLING pills after Stats (same
 *  grammar as the team hub's squad units / stat categories): a
 *  category pill is the Stats pane filtered to that one card; Stats
 *  shows all nine. Labels must match StatsPane's section titles. */
export const FIXTURE_STAT_CATEGORIES = [
  'Overview',
  'Scoring',
  'Quarters',
  'Attack',
  'Kicking',
  'Set-Piece',
  'Breakdown',
  'Defence',
  'Discipline',
] as const;

export type SubTab = 'preview' | 'overview' | 'lineup' | 'stats' | 'analysis' | `stat:${string}`;

export const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  // Narrative arc first, reference material after. Pre-Match leads
  // with kickoff-frozen context — the backdrop the match plays out
  // against. Line-Up follows with the cast on the day; Timeline is the
  // running event log. Match Analysis sits straight after the events —
  // the analyst read of THIS match, live-updating and persisting at
  // full-time ("Match Analysis" pairs with "Pre-Match"; deliberately
  // NOT "Post-Match" since it also serves live fixtures, the card's
  // LIVE / FULL-TIME chips carrying the temporal state). Stats trails
  // as the reference table. (The Insights pill was retired 2026-07-06:
  // its charts live inside Match Analysis as evidence pages.) Reader
  // flows: expectation → cast → events → narrative → data.
  { id: 'preview', label: 'Pre-Match' },
  { id: 'lineup', label: 'Line-Up' },
  { id: 'overview', label: 'Timeline' },
  { id: 'analysis', label: 'Match Analysis' },
  { id: 'stats', label: 'Stats' },
  ...FIXTURE_STAT_CATEGORIES.map((label) => ({ id: `stat:${label}` as const, label })),
];

/** Fixture-drill sub-tab strip — thin wrapper over the shared
 *  SegmentedTabs pill row, keeping the SubTab union + order here. */
export function SubTabBar({ tab, onSelect }: { tab: SubTab; onSelect: (t: SubTab) => void }) {
  return <SegmentedTabs tabs={SUB_TABS} active={tab} onSelect={onSelect} />;
}
