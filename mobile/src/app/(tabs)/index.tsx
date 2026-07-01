import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { HomeRankingsCard } from '@/components/home-rankings-card';
import { Spacing } from '@/constants/theme';

/** Matches the carousel's SIDE_PAD so the rankings card visually aligns to
 * the centre carousel card. If the carousel's CARD_WIDTH formula changes,
 * bump this too. */
const HORIZONTAL_MARGIN = 40;

/**
 * Home. Two-stack layout:
 *   1. A timeline carousel of 7 fixtures around the "current" match.
 *   2. A World Rugby men's rankings preview card (top 5 + "see all").
 */
export default function HomeScreen() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FixtureCarousel />
        <View style={styles.rankingsWrap}>
          <HomeRankingsCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  scrollContent: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four + 16,
    gap: Spacing.four,
  },
  rankingsWrap: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
});
