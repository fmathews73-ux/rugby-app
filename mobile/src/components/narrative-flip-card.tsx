import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppLogo } from '@/components/app-logo';
import { Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Standard narrative back face — dark card matching the front's
 * footprint: title + close, then WHAT THIS SHOWS and THE READ blocks.
 */
export function NarrativeBack({
  title,
  purpose,
  read,
  onClose,
}: {
  title: string;
  purpose: ReactNode;
  read?: string | null;
  onClose: () => void;
}) {
  return (
    <View style={styles.backCard}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to chart">
          <AppLogo height={16} color={Colors.light.textSecondary} spin />
        </Pressable>
      </View>
      {/* NO scrolling — the narrative must fit the card's footprint.
          That cap is deliberate (owner rule): prose stays focused and
          to the point, or it gets cut. */}
      <View style={styles.backBody}>
        <Text style={styles.eyebrow}>About</Text>
        <Text style={styles.body}>{purpose}</Text>
        {/* Read block only renders when a narrative feed exists —
            explainer-only backs (Stats categories) omit it. */}
        {read !== undefined ? (
          <>
            <Text style={[styles.eyebrow, styles.eyebrowSpaced]}>Insights</Text>
            <Text style={styles.body}>{read ?? 'Analysing…'}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Card transition (app-wide since 2026-07-08, superseding the rotateY
 * flip): the narrative back face fades in over the chart — calm and
 * unhurried, letting the read arrive rather than snap. Pure
 * native-driver opacity.
 */
export function FadeCard({
  flipped,
  front,
  back,
  style,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fade = useRef(new Animated.Value(flipped ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: flipped ? 1 : 0,
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [flipped, fade]);

  return (
    <View style={style}>
      {front}
      <Animated.View
        style={[styles.revealFill, { opacity: fade }]}
        pointerEvents={flipped ? 'auto' : 'none'}>
        {back}
      </Animated.View>
    </View>
  );
}


/** Bold span for use inside `purpose` copy. */
export function BackStrong({ children }: { children: ReactNode }) {
  return <Text style={strongStyle}>{children}</Text>;
}

const strongStyle = { fontFamily: 'Barlow_600SemiBold', color: Colors.light.text };

const styles = StyleSheet.create({
  backCard: {
    flex: 1,
    // White narrative surface (owner call 2026-07-08) — the read
    // presents as the card's own page, dark text on white.
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: Spacing.three,
  },
  revealFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  title: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    // Brand red — the narrative page is signed by the mark.
    color: '#FF0000',
  },
  backBody: { flex: 1, overflow: 'hidden' },
  eyebrow: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    marginBottom: Spacing.one,
  },
  eyebrowSpaced: { marginTop: Spacing.two },
  // Matches the hero meta register (competition · venue line):
  // Barlow_500Medium sm in textSecondary.
  body: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    lineHeight: 18,
    color: Colors.light.textSecondary,
  },
});
