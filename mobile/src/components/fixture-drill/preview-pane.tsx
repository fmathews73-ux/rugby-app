import { StyleSheet, View } from 'react-native';

import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { Spacing } from '@/constants/theme';

// ─── Preview pane ────────────────────────────────────────────────────────────

/**
 * Pre-match team context — recent form, WR ranking trajectory, and season
 * KPI averages for both sides. Rendered as the leftmost sub-tab so viewers
 * land on "who are we comparing" before the match itself. Each card uses a
 * two-side toggle pill to switch between home and away.
 */
export function PreviewPane({
  homeTeamId,
  awayTeamId,
  asOfDate,
}: {
  homeTeamId: string;
  awayTeamId: string;
  /** Freezes every card on this pane to the state it would have shown
   *  the day of the fixture — Form / Trajectory / KPIs all drop data
   *  timestamped at or after this ISO string. Makes a fixture opened
   *  in 2027 still read as the *pre-match* view from 2025. */
  asOfDate: string;
}) {
  return (
    <View style={styles.insightsPaneStack}>
      {/* Form (last-10) leads — recent trend sets up the deeper season
          context (ranking trajectory + KPIs) below. Toggle pill switches
          home ↔ away. */}
      <ExtendedMomentum
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
      <RankingTrajectory
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
      <EfficiencyKpis
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
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
