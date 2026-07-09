import { StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize, TextTracking } from '@/constants/theme';

/**
 * Chart-card header title — the one-word title in the grey register.
 * Identity pairs (shields, codes) and comparison tags were trialled
 * here and removed (owner calls 2026-07-09): the title alone carries
 */
export function CardTitle({
  title,
}: {
  title: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
});
