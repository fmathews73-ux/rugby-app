import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { HomeRankingsCarousel } from '@/components/home-rankings-carousel';
import { MyTeamCard } from '@/components/my-team-card';
import { Spacing } from '@/constants/theme';

/**
 * Home. Three vertical sections:
 *   1. Timeline carousel of 7 fixtures around the "current" match.
 *   2. Rankings carousel — 2 pages, Men's + Women's.
 *   3. My Team card — user-selected favourite with Next / Last / Form.
 */
export default function HomeScreen() {
  return (
    // No 'bottom' edge on the SafeAreaView — the tab bar draws its own safe
    // area inset, so removing it here lets the ScrollView extend to the very
    // bottom of the screen and content scroll cleanly under the tab bar
    // (mirroring how content scrolls under the header at the top).
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FixtureCarousel />
        <HomeRankingsCarousel />
        <MyTeamCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  scrollContent: {
    paddingTop: Spacing.four,
    // No paddingBottom — cards scroll flush against the tab bar's opaque
    // white background, disappearing behind it the same way they disappear
    // behind the header at the top.
    paddingBottom: 0,
    // Inter-card gap matches the `paddingTop` inside each carousel's dotsRow
    // (Spacing.three = 16pt) so dots feel equally padded above and below.
    // Changing this in one place keeps that symmetry consistent for all cards.
    gap: Spacing.three,
  },
});
