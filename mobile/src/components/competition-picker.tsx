import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export interface PickerOption {
  id: string;
  label: string;
}

/**
 * Horizontal scrollable pill picker. Used at the top of Standings and
 * Fixtures to switch competition. Consistent with the sub-tab strip on
 * fixture detail — same visual language across the app.
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
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    // Horizontal padding sits on the WRAP (not inside the ScrollView) so
    // the ScrollView clip-bounds are actually inset — pills disappear at
    // the padded edge on the right, not at the screen edge. Result: the
    // scrollable strip visually spans the same column as any content
    // rendered below it, symmetric on both sides.
    paddingHorizontal: Spacing.four,
  },
  inner: {
    paddingVertical: Spacing.two + 2,
    gap: Spacing.two,
  },
  // Borderless — fills alone carry the active/inactive contrast (dark for
  // active, white for inactive against the grey page bg). Matches the
  // sub-tab + TeamToggle pill treatment across the app.
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: Colors.light.text,
  },
  pillInactive: {
    backgroundColor: '#FFFFFF',
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pillLabelActive: { color: Colors.light.background },
  pillLabelInactive: { color: Colors.light.textSecondary },
});
