import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
          {/* Outline circle glyph — matches the profile avatar's
              person-circle-outline treatment. */}
          <Ionicons name="chevron-back-circle-outline" size={28} color={Colors.light.textSecondary} />
        </Pressable>
      ) : (
        // Top-level screens: menu entry point (drawer TBD) — mirrors
        // the avatar's 28pt outline treatment on the right.
        <Pressable
          onPress={() => {
            // TODO: open the app menu once its surface is defined.
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={({ pressed }) => [styles.slot, styles.leftSlot, pressed && styles.slotPressed]}>
          <Ionicons name="menu-outline" size={28} color={Colors.light.textSecondary} />
        </Pressable>
      )}

      <View style={styles.centreSlot}>
        {/* Brand wordmark — text build in the app's sport-display face
            (Barlow Condensed 700 Italic). Name trial: RUGBYMETRICS
            (register #23 still open). */}
        <View style={styles.wordmarkRow} accessible accessibilityLabel="Rugby Metrics">
          {/* Tilted to echo the wordmark's italic axis. */}
          <View style={styles.logoTilt}>
            {/* Same fingerprint mark as the card triggers — identity
                black beside the wordmark, still (no spin) in the
                header. */}
            <Ionicons name="finger-print-outline" size={22} color={Colors.light.text} />
          </View>
          <Text style={styles.wordmarkMain}>RUGBYMETRICS</Text>
        </View>
      </View>
      {/* Profile avatar on the right (owner call 2026-07-08); Fantasy
          entry (register #25, deferred) will need a new home when it
          lands. */}
      <Pressable
        onPress={() => {
          // TODO: navigate to /profile once the screen is defined
          // (register #15, Phase 4).
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.slot, styles.rightSlot, pressed && styles.slotPressed]}>
        <Ionicons name="person-circle-outline" size={28} color={Colors.light.textSecondary} />
      </Pressable>
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
  logoTilt: {
    transform: [{ rotate: '10deg' }],
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  wordmarkMain: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 26,
    color: Colors.light.text,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
