import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize, TextWeight } from '@/constants/theme';

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
    // Normal weight — lets the "RUGBY" mark carry the visual heft while the
    // IQ superscript reads as a lighter tagline / descriptor.
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
