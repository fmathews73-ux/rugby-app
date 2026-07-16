import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

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
              person-circle-outline treatment, in the same chrome
              grey (cool-ground trial 2026-07-14 reverted same day). */}
          <Ionicons name="chevron-back-circle-outline" size={28} color="#C7CBD1" />
        </Pressable>
      ) : (
        // Hamburger REMOVED (owner call 2026-07-11): footer tabs carry
        // all primary nav; secondary surfaces live under the avatar.
        // Empty spacer keeps the wordmark centred.
        <View style={[styles.slot, styles.leftSlot]} />
      )}

      <View style={styles.centreSlot}>
        {/* Brand wordmark — text build in the app's sport-display face
            (Barlow Condensed 700 Italic). Name trial: RUGBYMETRICS
            (register #23 still open). */}
        {/* Wordmark-only header (owner call 2026-07-16): the print
            was REMOVED after colour trials (light ramp, slice, grey,
            deep ink) — it lives on the icon/splash/welcome and the
            card flip-triggers; the header is chrome, and the sliced
            name alone carries the brand here. */}
        <View style={styles.wordmarkRow} accessible accessibilityLabel="Rugby Metrics">
          {/* The welcome wordmark's two-tone slice at header scale
              (owner call 2026-07-14): PITCH_GREENS light zone over
              dark, hard diagonal from the R's lower quarter to the
              S's upper quarter. Fingerprint stays identity black for
              now. */}
          {/* Canvas hugs the rendered glyphs (~134pt at 26pt
              condensed) so the centred cluster is icon + gap + TEXT,
              not icon + gap + canvas-with-margin. */}
          <Svg width={136} height={30}>
            <Defs>
              <SvgLinearGradient
                id="header-wordmark-ramp"
                gradientUnits="userSpaceOnUse"
                x1="67"
                y1="1"
                x2="69"
                y2="32">
                <Stop offset="0" stopColor="#5CB04E" />
                <Stop offset="0.499" stopColor="#4DA344" />
                <Stop offset="0.501" stopColor="#1D6423" />
                <Stop offset="1" stopColor="#124E1B" />
              </SvgLinearGradient>
            </Defs>
            <SvgText
              x={0}
              y={25}
              textAnchor="start"
              fontFamily="BarlowCondensed_700Bold_Italic"
              fontSize={26}
              fill="url(#header-wordmark-ramp)">
              RUGBYMETRICS
            </SvgText>
          </Svg>
        </View>
      </View>
      {/* Profile avatar on the right (owner call 2026-07-08); Fantasy
          entry (register #25, deferred) will need a new home when it
          lands. */}
      <Pressable
        onPress={() => router.push('/account')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
        style={({ pressed }) => [styles.slot, styles.rightSlot, pressed && styles.slotPressed]}>
        {/* Chrome register — quiet-but-tappable, matching the
            inactive tabs so the wordmark owns the header. */}
        <Ionicons name="person-circle-outline" size={28} color="#C7CBD1" />
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
    borderBottomColor: '#E3E8EF',
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
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  slotPressed: { opacity: 0.5 },
});
