import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { MyTeamMatchesCard } from '@/components/my-team-matches-card';
import { MyTeamPreviewCards } from '@/components/my-team-preview-cards';
import { PageGradient } from '@/components/page-gradient';
import { TeamSelectorCard } from '@/components/team-selector-card';
import { PAGE_BOTTOM_INSET, Spacing } from '@/constants/theme';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

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
  const { refreshing, onRefresh } = usePullToRefresh();

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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#9CA3AF"
          />
        }>
        <FixtureCarousel />
        <TeamSelectorCard />
        <MyTeamMatchesCard />
        <MyTeamPreviewCards />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Transparent so the LinearGradient behind shows through — cards keep
  // their own solid-white fill so the gradient reads as the *page*
  // background, not a card background.
  safe: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { backgroundColor: 'transparent' },
  scrollContent: {
    // Matches the tightened Fixtures pickerWrap top-padding — hero card
    // sits close to the AppHeader's bottom hairline.
    paddingTop: Spacing.two,
    // Tightened after the analysis accordion was retired — the
    // carousel dots are the page's last element, so only a modest gap
    // to the tab bar is needed (Home-only; other pages keep the
    // PAGE_BOTTOM_INSET token).
    paddingBottom: Spacing.three,
    // Inter-card gap matches the `paddingTop` inside each carousel's dotsRow
    // (Spacing.three = 16pt) so dots feel equally padded above and below.
    // Changing this in one place keeps that symmetry consistent for all cards.
    gap: Spacing.three,
  },
});
