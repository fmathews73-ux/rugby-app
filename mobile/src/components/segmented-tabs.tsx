import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
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
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollX(e.nativeEvent.contentOffset.x);

  return (
    <View style={styles.wrap}>
      <ScrollView
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
  },
  inner: {
    paddingHorizontal: PillStrip.stripPadH,
    paddingVertical: PillStrip.stripPadV,
    gap: PillStrip.gap,
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
    backgroundColor: Colors.light.text,
  },
  pillInactive: {
    backgroundColor: '#F3F4F6',
  },
  pillLabel: {
    fontSize: PillStrip.labelSize,
    fontWeight: TextWeight.bold,
    letterSpacing: PillStrip.labelTracking,
  },
  pillLabelActive: { color: Colors.light.background },
  pillLabelInactive: { color: Colors.light.textSecondary },
});
