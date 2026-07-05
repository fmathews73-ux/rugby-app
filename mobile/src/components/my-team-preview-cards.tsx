import { useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { MyTeamProfileCard } from '@/components/my-team-profile-card';
import { Colors, Spacing } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

// App-wide 24pt card column — matches FixtureCarousel's card width and
// the Fixtures / Teams landing pages.
const HORIZONTAL_MARGIN = Spacing.four;

const CHART_PAGES = 3;

/**
 * Home-page my-team analytics block. The Profile radar card keeps its
 * own full-width slot (its dimensions are untouched); the OTHER chart
 * cards — Form (last 10), Ranking Trajectory, Efficiency KPIs — live in
 * a paged carousel beneath it with the same dot indicator as the
 * rankings carousel, so the stack stays short without losing any card.
 *
 * Same components as `PreviewPane` on the fixture drill; no
 * `compareTeamId` (toggle pill hidden) and no `asOfDate` (current
 * state, not a kickoff snapshot).
 *
 * Reads `useMyTeamId`; returns nothing until a team is selected —
 * [[team-selector-card]] above handles that prompt.
 */
export function MyTeamPreviewCards() {
  const [myTeamId] = useMyTeamId();
  const { width: screenWidth } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState(0);

  if (!myTeamId) return null;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx !== activeIdx && idx >= 0 && idx < CHART_PAGES) setActiveIdx(idx);
  };

  return (
    <>
      <View style={styles.wrap}>
        <MyTeamProfileCard />
      </View>

      <View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}>
          {/* "My Team ..." titles + no corner flag — the whole stack is
              already scoped to the selected team. */}
          <View style={[styles.page, { width: screenWidth }]}>
            <ExtendedMomentum
              teamId={myTeamId}
              style={styles.pageCard}
              title="My Team Form"
              showCornerFlag={false}
            />
          </View>
          <View style={[styles.page, { width: screenWidth }]}>
            <RankingTrajectory
              teamId={myTeamId}
              style={styles.pageCard}
              title="My Team World Ranking"
              showCornerFlag={false}
            />
          </View>
          <View style={[styles.page, { width: screenWidth }]}>
            <EfficiencyKpis
              teamId={myTeamId}
              style={styles.pageCard}
              title="My Team Efficiency KPIs"
              showCornerFlag={false}
            />
          </View>
        </ScrollView>

        <View style={styles.dotsRow}>
          {Array.from({ length: CHART_PAGES }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, activeIdx === i ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
  // Each carousel page spans the full screen width with the card column
  // inset inside it, so a swipe lands the next card exactly in the
  // 24pt column. Pages top-align; the tallest card sets the height.
  page: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
  // Cards flex to fill their page, and pages stretch to the row's
  // tallest sibling — so all three carousel cards render equal height,
  // with shorter cards' content settling into the extra bottom space.
  pageCard: {
    flex: 1,
  },
  // Same dot grammar as HomeRankingsCarousel.
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.three,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { backgroundColor: Colors.light.textSecondary },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
  },
});
