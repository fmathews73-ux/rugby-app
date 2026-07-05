import { type ReactNode, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

/**
 * Paged card carousel — full-screen-width pages with the app-wide 24pt
 * card column inset inside each, and the shared 6px dot indicator
 * underneath (same grammar as HomeRankingsCarousel). Used for the
 * chart-card carousels on Home and the fixture drill's Preview pane.
 *
 * Pages top-align and the tallest page sets the row height; pass each
 * card `style={{ flex: 1 }}` (the insight cards' style prop) so
 * shorter cards stretch to match.
 */
export function CardCarousel({ pages }: { pages: readonly ReactNode[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx !== activeIdx && idx >= 0 && idx < pages.length) setActiveIdx(idx);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        {pages.map((page, i) => (
          <View key={i} style={[styles.page, { width: screenWidth }]}>
            {page}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {pages.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, activeIdx === i ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: Spacing.four,
  },
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
