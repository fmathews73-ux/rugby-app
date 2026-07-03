import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize, TextTracking, TextWeight } from '@/constants/theme';

export type ToggleSide = 'primary' | 'compare';

/**
 * Two-segment toggle pill used across the Insights cards when a compare
 * team is set — the header carries `[PRIMARY | COMPARE]` and the card body
 * shows one team's data at a time. Container is borderless; each segment
 * owns its own outline (light on inactive, dark on active) so the outer
 * border swaps colour with the selection.
 */
export function TeamToggle({
  primaryLabel,
  compareLabel,
  activeSide,
  onSelect,
}: {
  primaryLabel: string;
  compareLabel: string;
  activeSide: ToggleSide;
  onSelect: (side: ToggleSide) => void;
}) {
  return (
    <View style={styles.pill}>
      <Segment
        label={primaryLabel}
        active={activeSide === 'primary'}
        position="left"
        onPress={() => onSelect('primary')}
      />
      <Segment
        label={compareLabel}
        active={activeSide === 'compare'}
        position="right"
        onPress={() => onSelect('compare')}
      />
    </View>
  );
}

function Segment({
  label,
  active,
  position,
  onPress,
}: {
  label: string;
  active: boolean;
  position: 'left' | 'right';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.side,
        position === 'left' ? styles.sideLeft : styles.sideRight,
        active && styles.sideActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Show ${label}`}
      accessibilityState={{ selected: active }}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
  },
  // Borderless — fills alone carry the active/inactive contrast. Inactive
  // is a subtle grey; active is the primary text token. Sides no longer
  // need per-position styles since there's no border to hide at the seam.
  side: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    minWidth: 44,
    alignItems: 'center',
  },
  sideLeft: {},
  sideRight: {},
  sideActive: {
    backgroundColor: Colors.light.text,
  },
  label: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  labelActive: {
    color: Colors.light.textInverse,
  },
});
