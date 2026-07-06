import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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
export interface CardCarouselHandle {
  /** Scroll to a page index — animated for accordion sync taps,
   *  instant (animated=false) for focus resets. */
  scrollToPage: (index: number, animated?: boolean) => void;
}

export const CardCarousel = forwardRef<
  CardCarouselHandle,
  {
    pages: readonly ReactNode[];
    /** Fires when the visible page changes (swipe or programmatic). */
    onPageChange?: (index: number) => void;
  }
>(function CardCarousel({ pages, onPageChange }, ref) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useImperativeHandle(ref, () => ({
    scrollToPage: (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, index));
      scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated });
      setActiveIdx(clamped);
    },
  }));

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx !== activeIdx && idx >= 0 && idx < pages.length) {
      setActiveIdx(idx);
      onPageChange?.(idx);
    }
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
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
});

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
