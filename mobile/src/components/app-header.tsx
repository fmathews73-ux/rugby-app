import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Persistent header (PRD §4.1). Left: user profile avatar / entry point on
 * top-level tab screens; back arrow on nested detail screens (fixture[id],
 * team[id], etc.) so the user can pop back to the list without losing the
 * shared header + tab bar.
 * Centre: reserved for logo/brand (register #23 — undefined; leave blank).
 * Right: reserved for Fantasy entry point (register #25 — deferred).
 *
 * "Nested" is detected via `useSegments()` — anything deeper than
 * `['(tabs)', <tabName>]` is a nested screen. Top-level tab paths are
 * exactly two segments long (the group + the tab name).
 */
export function AppHeader() {
  const router = useRouter();
  const segments = useSegments();
  const isNested = segments.length > 2;

  return (
    <View style={styles.container}>
      {isNested ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.slot, styles.leftSlot, pressed && styles.slotPressed]}>
          <Ionicons name="chevron-back" size={28} color={Colors.light.text} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            // TODO: navigate to /profile once the screen is defined
            // (register #15, Phase 4).
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.slot, styles.leftSlot, pressed && styles.slotPressed]}>
          <Ionicons name="person-circle-outline" size={32} color={Colors.light.text} />
        </Pressable>
      )}

      <View style={styles.centreSlot}>
        {/* Brand wordmark — owner-supplied image asset (transparent
            PNG, 658×260). Replaces the earlier Anton text build of the
            same mark; the source of truth is the asset now. */}
        <Image
          source={require('../../assets/images/rugby-iq-logo.png')}
          style={styles.wordmark}
          contentFit="contain"
          accessible
          accessibilityLabel="Rugby IQ"
        />
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
    // Flat pure-white header on a slightly darker page bg — Stripe /
    // Linear / Grafana pattern. Hairline divider carries the visual
    // separation instead of a colour contrast.
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
  // 658×260 source — height 28 keeps it crisp inside the 44pt header,
  // width follows the source aspect ratio.
  wordmark: {
    height: 28,
    width: 28 * (658 / 260),
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
