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

import { Colors, PillStrip } from '@/constants/theme';

export interface PickerOption {
  id: string;
  label: string;
}

// Strip surface — white, matching SegmentedTabs so every pill strip
// in the app sits on the same bonded white band; fades dissolve
// overflowing pills into it.
const STRIP_BG = '#FFFFFF';

/**
 * Horizontal scrollable pill picker. Used at the top of Standings and
 * Fixtures to switch competition. Consistent with the sub-tab strip on
 * fixture detail — same visual language across the app, including the
 * scroll-aware edge fades.
 */
export function CompetitionPicker({
  options,
  selected,
  onSelect,
}: {
  options: readonly PickerOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
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
        {options.map((opt) => {
          const active = opt.id === selected;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
              <Text
                style={[styles.pillLabel, active ? styles.pillLabelActive : styles.pillLabelInactive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {showEndFade ? (
        <LinearGradient
          colors={['rgba(255,255,255,0)', STRIP_BG]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.endFade}
          pointerEvents="none"
        />
      ) : null}
      {showStartFade ? (
        <LinearGradient
          colors={[STRIP_BG, 'rgba(255,255,255,0)']}
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
    backgroundColor: STRIP_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  // Horizontal padding lives on the CONTENT (not the wrap) so pills
  // stay visible to the screen edge and dissolve under the edge fades —
  // clipping at a padded bound gives a hard cut the gradient can't hide
  // (same fix as SegmentedTabs).
  inner: {
    paddingHorizontal: PillStrip.stripPadH,
    paddingVertical: PillStrip.stripPadV,
    gap: PillStrip.gap,
  },
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
  // Borderless — fills alone carry the active/inactive contrast (grey
  // fill for active, light grey for inactive on the white strip).
  // Identical treatment to SegmentedTabs.
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
    fontFamily: 'WorkSans_500Medium',
    fontSize: PillStrip.labelSize,
    letterSpacing: PillStrip.labelTracking,
  },
  pillLabelActive: { color: '#FFFFFF' },
  pillLabelInactive: { color: Colors.light.textSecondary },
});
