import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { CardCarousel } from '@/components/card-carousel';
import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
import { ControlConversion } from '@/components/insights/control-conversion';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { PitchHeatmap } from '@/components/insights/pitch-heatmap';
import { ScoringProgression } from '@/components/insights/scoring-progression';
import { Spacing } from '@/constants/theme';

// ─── Insights pane ───────────────────────────────────────────────────────────

/**
 * Per-fixture Insights — sits next to the Stats sub-tab so users flipping
 * between the raw numbers and the analytics view during a live match don't
 * travel far. Scoped to this fixture's two teams (home + away), so there's
 * no team-picker chrome. Rendered inside the fixture-drill ScrollView, so
 * no SafeAreaView / ScrollView of its own.
 */
export function InsightsPane({
  fixtureId,
  homeTeamId,
  awayTeamId,
  fixtureStatus,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  fixtureStatus: Fixture['status'];
}) {
  return (
    <View style={styles.insightsPaneStack}>
      {/* Headline card — the head-to-head Profile radar stays static
          (mirroring Home / team Preview, where the profile anchors and
          the rest carousels). */}
      <InsightsCanvas
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />

      {/* The match-flow cards carousel beneath: initiative (Momentum),
          result (Progression), verdict (Control vs Conversion), and
          where (Heatmap). Full-width pages bleed out of the pane's
          24pt padding and re-apply the card column internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel
          pages={[
            <CombinedPointsPattern
              key="momentum"
              fixtureId={fixtureId}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              style={styles.pageCard}
            />,
            <ScoringProgression
              key="progression"
              fixtureId={fixtureId}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              fixtureStatus={fixtureStatus}
              style={styles.pageCard}
            />,
            <ControlConversion
              key="verdict"
              fixtureId={fixtureId}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              fixtureStatus={fixtureStatus}
              style={styles.pageCard}
            />,
            <PitchHeatmap
              key="heatmap"
              fixtureId={fixtureId}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              fixtureStatus={fixtureStatus}
              style={styles.pageCard}
            />,
          ]}
        />
      </View>
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
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
});
