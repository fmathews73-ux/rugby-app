import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // White strip continues the header card into the tab-bar row so the
    // top of the screen reads as one bonded surface; the grey page
    // background starts BELOW the pills. Horizontal padding sits on the
    // WRAP so the ScrollView clip-bounds are inset (pills vanish at the
    // padded edge, not the screen edge) — same trick as
    // CompetitionPicker.
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: PillStrip.stripPadH,
  },
  inner: {
    paddingVertical: PillStrip.stripPadV,
    gap: PillStrip.gap,
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
