import { SegmentedTabs } from '@/components/segmented-tabs';

export type SubTab = 'preview' | 'overview' | 'lineup' | 'stats' | 'insights' | 'analysis';

export const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  // Temporal flow, synthesis at the end. Preview leads with pre-match
  // context (form, ranking trajectory, season baselines) — the backdrop
  // the match plays out against. Line-Up follows with the cast on the
  // day. Timeline is the running event log ("what happens / happened").
  // Stats is the numeric record; Insights the visual analytical read.
  // Analysis closes — the AI narrative synthesis that pulls everything
  // before it together into a written story. Reader flows left-to-right
  // through: expectation → cast → events → data → visual → narrative.
  { id: 'preview', label: 'Preview' },
  { id: 'lineup', label: 'Line-Up' },
  { id: 'overview', label: 'Timeline' },
  { id: 'stats', label: 'Stats' },
  { id: 'insights', label: 'Insights' },
  { id: 'analysis', label: 'Analysis' },
];

/** Fixture-drill sub-tab strip — thin wrapper over the shared
 *  SegmentedTabs pill row, keeping the SubTab union + order here. */
export function SubTabBar({ tab, onSelect }: { tab: SubTab; onSelect: (t: SubTab) => void }) {
  return <SegmentedTabs tabs={SUB_TABS} active={tab} onSelect={onSelect} />;
}
