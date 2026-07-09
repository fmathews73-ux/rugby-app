import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, PillStrip, TextWeight } from '@/constants/theme';

/**
 * Drill-page sub-tab pill row — the fixture / team / player drill
 * counterpart of the landing pages' CompetitionPicker. Pills are
 * content-width (label + PillStrip.padH each side), NOT equal-flex, so
 * a pill is dimensionally identical on every strip in the app no matter
 * how many tabs the strip carries; the row scrolls horizontally when
 * the tabs overflow. Only the surface differs from CompetitionPicker:
 * this strip is white (continuing the bonded hero header above) with a
 * grey inactive fill, where the filter strips sit on the grey page with
 * a white inactive fill.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onSelect,
  rightAccessory,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
  /** Centre the pills in the strip when they fit (short fixed sets
   *  like the team hub's three tabs); overflowing strips scroll as
   *  normal either way. */
  /** Optional content pinned at the strip's right edge, outside the
   *  scrolling pill area (e.g. the team hub's squad totals). */
  rightAccessory?: React.ReactNode;
  /** Optional second pill group rendered in the SAME strip after a
   *  thin divider, with its own selection — the team hub merges its
   *  squad unit filter into the drill bar this way. */
  secondary?: {
    tabs: readonly { id: string; label: string }[];
    active: string;
    onSelect: (id: string) => void;
  };
}) {
  // Right-edge fade: a clean clip reads as "the row ends here", hiding
  // any pill that's scrolled out of view (users were missing Analysis).
  // The white gradient signals more content; it drops away once the
  // strip is scrolled to the end (or never overflows).
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const showEndFade = contentW > viewportW && scrollX < contentW - viewportW - 4;
  const showStartFade = contentW > viewportW && scrollX > 4;

  const scrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const pillLayouts = useRef<Partial<Record<T, { x: number; w: number }>>>({});

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollXRef.current = e.nativeEvent.contentOffset.x;
    setScrollX(e.nativeEvent.contentOffset.x);
  };

  // Selection auto-scroll: bring the active pill AND its next
  // neighbour fully into view (mirrored on the left), so selecting the
  // second-to-last pill always reveals the last one — users were
  // missing Stats behind the edge fade after tapping Match Analysis.
  useEffect(() => {
    if (viewportW === 0) return;
    const idx = tabs.findIndex((t) => t.id === active);
    const cur = pillLayouts.current[active];
    if (idx < 0 || !cur) return;
    const next = idx + 1 < tabs.length ? pillLayouts.current[tabs[idx + 1].id] : null;
    const prev = idx > 0 ? pillLayouts.current[tabs[idx - 1].id] : null;
    const rightEdge = (next ? next.x + next.w : cur.x + cur.w) + PillStrip.stripPadH;
    const leftEdge = (prev ? prev.x : cur.x) - PillStrip.stripPadH;
    const x = scrollXRef.current;
    if (rightEdge - x > viewportW) {
      scrollRef.current?.scrollTo({ x: rightEdge - viewportW, animated: true });
    } else if (leftEdge < x) {
      scrollRef.current?.scrollTo({ x: Math.max(0, leftEdge), animated: true });
    }
  }, [active, viewportW, tabs]);

  return (
    <View style={styles.wrap}>
      <View style={styles.scrollArea}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setViewportW(Math.round(e.nativeEvent.layout.width))}
        onContentSizeChange={(w) => setContentW(Math.round(w))}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.inner}>
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              onLayout={(e) => {
                pillLayouts.current[t.id] = {
                  x: e.nativeEvent.layout.x,
                  w: e.nativeEvent.layout.width,
                };
              }}
              style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}>
              <Text
                style={[
                  styles.pillLabel,
                  isActive ? styles.pillLabelActive : styles.pillLabelInactive,
                ]}
                numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {showEndFade ? (
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.endFade}
          pointerEvents="none"
        />
      ) : null}
      {showStartFade ? (
        <LinearGradient
          colors={['#FFFFFF', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.startFade}
          pointerEvents="none"
        />
      ) : null}
      </View>
      {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // White strip continues the header card into the tab-bar row so the
    // top of the screen reads as one bonded surface; the grey page
    // background starts BELOW the pills. Horizontal padding lives on the
    // CONTENT (not the wrap) so pills stay visible right up to the
    // screen edge and dissolve under the edge fades — clipping at a
    // padded bound gave a hard cut the gradient couldn't hide.
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The scrolling pill area (and its edge fades) own the flexible
  // width; the accessory sits outside it so pills fade out before
  // reaching it.
  scrollArea: { flex: 1 },
  accessory: { paddingRight: PillStrip.stripPadH, paddingLeft: 4 },
  inner: {
    paddingHorizontal: PillStrip.stripPadH,
    paddingVertical: PillStrip.stripPadV,
    gap: PillStrip.gap,
    // Centre short fixed sets (team hub's three pills); flexGrow only
    // engages when content is narrower than the strip, so overflowing
    // strips (fixture drill) scroll exactly as before.
    flexGrow: 1,
    justifyContent: 'center',
  },
  // Edge fades — dissolve the overflowing pill into the surface white
  // so the eye reads "more that way". Pills scroll beneath them to the
  // screen edge; the gradient reaches solid white at the edge itself.
  endFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PillStrip.stripPadH + 20,
  },
  startFade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: PillStrip.stripPadH + 20,
  },
  pill: {
    paddingHorizontal: PillStrip.padH,
    paddingVertical: PillStrip.padV,
    borderRadius: PillStrip.radius,
  },
  pillActive: {
    backgroundColor: Colors.light.textSecondary,
  },
  pillInactive: {
    backgroundColor: '#F3F4F6',
  },
  pillLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: PillStrip.labelSize,
    letterSpacing: PillStrip.labelTracking,
  },
  pillLabelActive: { color: '#FFFFFF' },
  pillLabelInactive: { color: Colors.light.textSecondary },
});
