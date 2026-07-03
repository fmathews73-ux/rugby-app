import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { MyTeamCard } from '@/components/my-team-card';
import { PageGradient } from '@/components/page-gradient';
import { Spacing } from '@/constants/theme';

/**
 * Home. Two vertical sections:
 *   1. Timeline carousel of 7 fixtures around the "current" match.
 *   2. My Team card — user-selected favourite with Next / Last / Form.
 *
 * (Rankings carousel lives on the Rankings tab, not here.)
 *
 * Background is a vertical pastel gradient (sky → mint) applied via
 * `expo-linear-gradient`. `react-native-svg`'s gradient rect can jump
 * above sibling RN views on iOS due to native-layer stacking, which
 * hid the cards; expo-linear-gradient is a plain RN view + native
 * gradient with no such quirk.
 *
 * Tapping the Home tab icon (whether already focused or navigating in)
 * scrolls back to the top so the hero fixture card is always the
 * resolve-to landmark for a Home click.
 */
export default function HomeScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as never, () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  return (
    // No 'bottom' edge on the SafeAreaView — the tab bar draws its own
    // safe area inset, so removing it here lets the ScrollView extend to
    // the very bottom of the screen and content scroll cleanly under the
    // tab bar (mirroring how content scrolls under the header at the top).
    // The LinearGradient serves as the background fill — the SafeAreaView
    // is transparent so the gradient shows through.
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <FixtureCarousel />
        <MyTeamCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Transparent so the LinearGradient behind shows through — cards keep
  // their own solid-white fill so the gradient reads as the *page*
  // background, not a card background.
  safe: { flex: 1, backgroundColor: 'transparent' },
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
