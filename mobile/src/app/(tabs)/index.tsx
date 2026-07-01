import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { HomeRankingsCarousel } from '@/components/home-rankings-carousel';
import { Spacing } from '@/constants/theme';

/**
 * Home. Two vertical sections:
 *   1. Timeline carousel of 7 fixtures around the "current" match.
 *   2. Rankings carousel — 2 pages, Men's + Women's placeholder.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FixtureCarousel />
        <HomeRankingsCarousel />
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
});
