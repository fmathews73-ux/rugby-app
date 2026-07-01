import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Persistent header (PRD §4.1). Left: user profile avatar / entry point.
 * Centre: reserved for logo/brand (register #23 — undefined; leave blank).
 * Right: reserved for Fantasy entry point (register #25 — deferred).
 *
 * Only the profile icon is wired for now. Tap is a no-op stub until the
 * profile screen contents are specified (register #15, INPUT NEEDED Phase 4).
 */
export function AppHeader() {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          // TODO: navigate to /profile once the screen is defined
          // (register #15, Phase 4).
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.slot, styles.leftSlot, pressed && styles.slotPressed]}>
        <Ionicons name="person-circle-outline" size={32} color={Colors.light.text} />
      </Pressable>

      <View style={styles.centreSlot}>
        <View style={styles.appNameRow}>
          <Text style={styles.appName}>RUGBY</Text>
          <Ionicons name="add" size={22} color={Colors.light.text} />
        </View>
      </View>
      {/* Right slot reserved for Fantasy entry (register #25 deferred). */}
      <View style={styles.rightSlot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  slot: {
    minWidth: 44,
    alignItems: 'flex-start',
  },
  leftSlot: {},
  centreSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: 0.6,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
