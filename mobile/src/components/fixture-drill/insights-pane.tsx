import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
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
      <InsightsCanvas
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />
      {/* Momentum — mirrored area chart. Home team lifts above the zero
          baseline in light blue, away drops below in light purple.
          Rolling 10-minute scoring density per side across the 80'
          match canvas, with KO / HT / FT milestone verticals. Paired
          adjacent to Scoring Progression below so the reader can compare
          in-match INITIATIVE (this card) with in-match RESULT (below). */}
      <CombinedPointsPattern
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
      />
      {/* Scoring progression — broadcast-worm cumulative-points chart.
          Both team lines overlaid so the story (leads, comebacks, lead
          changes) reads directly from where the worms cross. Sits
          directly after Momentum since both are temporal match-flow
          cards on the same 0..80' axis. */}
      <ScoringProgression
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />
      {/* Pitch heatmap — density of the active team's positional events
          (carries + scoring) on a top-down pitch. Match-scoped. Closes
          the Insights pane as the spatial detail card — the "where"
          after the "who / when / result" story above. */}
      <PitchHeatmap
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
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
