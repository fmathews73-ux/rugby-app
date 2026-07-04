import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize, TextWeight } from '@/constants/theme';

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
        {/* Brand mark: "RUGBY" + superscripted "IQ". `alignItems: 'flex-start'`
            on the row aligns top-edges, so the smaller IQ Text sits above
            RUGBY's baseline — the superscript effect. Font family reserved
            for Proxima Nova once licensed + loaded via expo-font; until
            then the system extra-bold face carries the weight. */}
        <View style={styles.appNameRow}>
          <Text style={styles.appName}>RUGBY</Text>
          <Text style={styles.appNameSuperscript}>IQ</Text>
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
  appNameRow: {
    flexDirection: 'row',
    // flex-start aligns the top edges of RUGBY and IQ — the IQ Text is
    // smaller so its baseline sits above RUGBY's baseline, giving the
    // superscript effect. Do NOT set alignItems: 'center' here.
    alignItems: 'flex-start',
    gap: 1,
  },
  appName: {
    fontSize: TextSize.xl,
    // Extra-bold (800) — off the TextWeight scale, allowed as a brand-mark
    // exception (same category as the intentional letterSpacing: -1 for
    // hero display numbers). Do not use elsewhere.
    fontWeight: '800',
    color: Colors.light.text,
    // fontFamily: 'ProximaNova-ExtraBold' — reserved. Requires (a) a
    // commercial licence from Mark Simonson Studio / Adobe Fonts and
    // (b) the font loaded via expo-font at app startup. Falls back to
    // system extra-bold until then.
  },
  appNameSuperscript: {
    fontSize: 12, // ~55% of appName size, standard superscript ratio
    // Normal weight — lets the "RUGBY" mark carry the visual heft while
    // the IQ superscript reads as a lighter tagline / descriptor.
    fontWeight: TextWeight.regular,
    color: Colors.light.text,
    // Small nudge down so IQ's cap-line aligns near the cap-line of
    // RUGBY rather than sitting flush at the very top of the row.
    marginTop: 1,
    // Tight line-height keeps the superscript compact.
    lineHeight: 12,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
