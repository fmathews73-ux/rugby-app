import {
  createContext,
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
/**
 * True while the surrounding carousel page is the visible one; true by
 * default so standalone cards (stats stack, player screen) behave as
 * always-active. Lets per-card attention cues (the logo trigger's
 * spin-on-mount) re-fire when their page swipes into view.
 */
export const CarouselPageActiveContext = createContext(true);

export interface CardCarouselHandle {
  /** Scroll to a page index — animated for accordion sync taps,
   *  instant (animated=false) for focus resets. */
  scrollToPage: (index: number, animated?: boolean) => void;
}

// Truncated dot strip — beyond this many pages the strip windows
// around the active dot (Instagram pattern) instead of growing.
const MAX_DOTS = 7;

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
  // While a programmatic scroll is in flight, its intermediate frames
  // still round to the ORIGIN page — reporting those through
  // onPageChange let the landing overwrite the section the user just
  // tapped (tap Keys → carousel animates → lands reporting "Shape").
  // The target ref mutes onPageChange until the scroll lands; a user
  // drag reclaims control immediately.
  const programmaticTarget = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToPage: (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, index));
      programmaticTarget.current = clamped;
      scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated });
      setActiveIdx(clamped);
    },
  }));

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    if (programmaticTarget.current !== null) {
      // In-flight programmatic scroll: swallow events (dots already
      // show the target) until it lands on the target offset.
      if (
        idx === programmaticTarget.current &&
        Math.abs(x - idx * screenWidth) < 2
      ) {
        programmaticTarget.current = null;
      }
      return;
    }
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
        onScrollBeginDrag={() => {
          programmaticTarget.current = null;
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        {pages.map((page, i) => (
          <View key={i} style={[styles.page, { width: screenWidth }]}>
            <CarouselPageActiveContext.Provider value={activeIdx === i}>
              {page}
            </CarouselPageActiveContext.Provider>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {(() => {
          const n = pages.length;
          const windowed = n > MAX_DOTS;
          const start = windowed
            ? Math.max(0, Math.min(activeIdx - Math.floor(MAX_DOTS / 2), n - MAX_DOTS))
            : 0;
          const count = windowed ? MAX_DOTS : n;
          return Array.from({ length: count }, (_, k) => {
            const i = start + k;
            // Edge dots shrink when pages continue past that side of
            // the window — the "there's more" cue.
            const isEdgeCue =
              windowed &&
              ((k === 0 && start > 0) || (k === count - 1 && start + count < n));
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isEdgeCue && styles.dotSmall,
                  activeIdx === i ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          });
        })()}
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
    alignItems: 'center',
    gap: 8,
    paddingTop: Spacing.three,
    // Fixed height so 6pt and 4pt dots baseline-centre without the
    // row breathing when the window slides.
    height: 14,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotSmall: { width: 4, height: 4 },
  dotActive: { backgroundColor: Colors.light.textSecondary },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
  },
});
