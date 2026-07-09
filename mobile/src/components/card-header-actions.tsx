import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FlipTrigger } from '@/components/flip-trigger';
import { Spacing } from '@/constants/theme';

/**
 * HARD DESIGN RULE (owner call 2026-07-09): every chart-card header's
 * action cluster is [toggle?] · FIXED 16pt gap · fingerprint trigger,
 * pinned to the right edge with both elements vertically centred on
 * the title line. One component so the geometry can never drift
 * card-to-card.
 */
export function CardHeaderActions({
  toggle,
  onExplain,
  accessibilityLabel,
}: {
  /** Optional TeamToggle (or other control) locked left of the
   *  trigger. */
  toggle?: ReactNode;
  onExplain: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.cluster}>
      {toggle}
      <Pressable
        onPress={onExplain}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        <FlipTrigger />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    // THE fixed separation: toggle right edge ↔ trigger left edge.
    gap: Spacing.three,
  },
});
