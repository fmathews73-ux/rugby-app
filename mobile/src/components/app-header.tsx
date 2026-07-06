import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize } from '@/constants/theme';

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
            RUGBY's baseline — the superscript effect. Face is Anton
            (loaded in the root layout) — the Impact stand-in, since
            Impact isn't shipped on iOS/Android and can't be bundled
            without a Monotype licence. Neither face has a true italic,
            so the skew transform on the row supplies the slant. */}
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
    // Synthetic italic: Anton ships upright-only, so the slant is a
    // skew on the whole row (keeps RUGBY + IQ on the same angle).
    // scaleY squashes Anton's tall condensed caps into a flatter,
    // wider-reading mark without touching the letter widths.
    transform: [{ skewX: '-10deg' }, { scaleY: 0.8 }],
  },
  appName: {
    fontSize: TextSize.xl,
    fontFamily: 'Anton_400Regular',
    // Anton sets very tight by default; open the tracking so the
    // condensed caps breathe.
    letterSpacing: 1.5,
    color: Colors.light.text,
  },
  appNameSuperscript: {
    fontSize: 12, // ~55% of appName size, standard superscript ratio
    // Superscript stays on the brand face but at reduced size, reading
    // as the lighter descriptor against RUGBY's heft.
    fontFamily: 'Anton_400Regular',
    color: Colors.light.text,
    // Line box must clear Anton's tall ascender or the glyph tops get
    // clipped (Anton's cap height exceeds a lineHeight equal to the
    // font size). 16 gives the caps room; the row's flex-start
    // alignment still produces the superscript position.
    lineHeight: 16,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
