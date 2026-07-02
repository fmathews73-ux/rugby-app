import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, TextSize, TextWeight } from '@/constants/theme';
import { MoversStrip } from '@/components/insights/movers-strip';
import { TeamGrid } from '@/components/insights/team-grid';

const HORIZONTAL_MARGIN = 40; // Matches Movers + TeamGrid card panels.

/**
 * Insights — the app's BI tab. Landing view is global: a strip of biggest
 * momentum movers, then a grid of Tier-1 teams tiled with mini momentum
 * sparklines. Each tile drills into a per-team analytics page (Radar,
 * Momentum, Trajectory, KPIs) that lives at `src/app/insights/[teamId].tsx`.
 */
export default function InsightsScreen() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Form, momentum, and team profiles across Tier 1.</Text>
        </View>

        <MoversStrip />
        <TeamGrid />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: {
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  headerBlock: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: Spacing.three,
    gap: 4,
  },
  title: {
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
});
