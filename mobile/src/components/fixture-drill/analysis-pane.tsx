import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { MatchAnalysisCard } from '@/components/match-analysis-card';
import { Spacing } from '@/constants/theme';

// ─── Analysis pane ───────────────────────────────────────────────────────────

/**
 * AI-generated broadcast-style commentary on the fixture. Reads the same
 * data all other panes read (result totals, event timeline) via the
 * `useMatchAnalysis` hook. Renders inside the shared stack so vertical
 * chrome (padding, gap) matches the Insights and Stats panes.
 *
 * Scheduled fixtures render an empty-state message inside the card —
 * there's no history to analyse yet.
 */
export function AnalysisPane({ fixture }: { fixture: Fixture }) {
  return (
    <View style={styles.insightsPaneStack}>
      <MatchAnalysisCard fixture={fixture} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Insights pane — vertical stack of the same BI cards used on the
  // Insights tab, scoped to this fixture's two teams. Each card handles its
  // own horizontal margin, so the stack just needs vertical breathing room.
  // No paddingBottom — the drill screen's scroll container owns the
  // bottom inset (60pt), same as the team / player drills.
  insightsPaneStack: { gap: Spacing.three },
});
