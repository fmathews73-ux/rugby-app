import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * THE legend register (matrix size-key voice, owner-settled): 9px
 * swatch at 45% opacity, Barlow_500Medium 8 uppercase in secondary
 * grey. Every chart legend renders through this — local copies
 * drifted into condensed faces and full-opacity swatches (2026-07-10
 * consistency audit, finding 4).
 */
export function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.item}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 999,
    opacity: 0.45,
  },
  text: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 8,
    letterSpacing: 0.4,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
});
