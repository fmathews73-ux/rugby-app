import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { CardTitle } from '@/components/card-title';
import { fitToLines } from '@/lib/fit-narrative';
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
  /** Team identity pair beside the title (team-scoped cards) — same
   *  treatment as the front header; match cards pass both sides. */
  purpose: ReactNode;
  read?: string | null;
  onClose: () => void;
}) {
  // Overflow failsafe: the Insights block gets whatever height remains
  // and clamps its prose to the whole lines that fit (ellipsis beyond).
  // Content should never actually hit this — the narrative spec's
  // length budget (§5.7) caps generation — but a clean ellipsis beats
  // text silently vanishing below the card edge.
  const [readLines, setReadLines] = useState<number>();

  if (__DEV__ && typeof read === 'string' && read.length > 900) {
    // Tripwire for the narrative material ceiling — composite reads
    // arrive pre-fitted to ≤900 chars (display then sentence-fits to
    // the measured card); anything past this leaked around
    // fitNarrative and needs its call site fixed (spec §5.7).
    console.warn(
      `Narrative over material ceiling on "${title}": ${read.length} chars (cap 900)`,
    );
  }

  return (
    <View style={styles.backCard}>
      <View style={styles.headerRow}>
        <CardTitle
          title={title}
        />
        <Pressable
          onPress={onClose}
          style={styles.headerClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to chart">
          <Ionicons name="arrow-back-circle-outline" size={18} color={Colors.light.textSecondary} />
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
          <View
            style={styles.readFill}
            onLayout={(e) =>
              // Eyebrow (~line-height + spacing) comes out of the block's
              // measured height before line capacity is computed. NO
              // minimum: a card whose About fills it renders no partial
              // Insights (a forced 2-line floor was slicing text at the
              // card edge on the short stats cards).
              setReadLines(
                Math.floor((e.nativeEvent.layout.height - READ_EYEBROW_HEIGHT) / BODY_LINE_HEIGHT),
              )
            }>
            {readLines === undefined || readLines >= 1 ? (
              <>
                <Text style={[styles.eyebrow, styles.eyebrowSpaced]}>Insights</Text>
                {/* Sentence-fit to the measured capacity — every card
                    carries as much whole-sentence prose as it can hold;
                    numberOfLines stays as the belt-and-braces clamp. */}
                <Text style={styles.body} numberOfLines={readLines}>
                  {read && readLines ? fitToLines(read, readLines) : (read ?? 'Analysing…')}
                </Text>
              </>
            ) : null}
          </View>
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

const BODY_LINE_HEIGHT = 18;
// Insights eyebrow footprint inside the measured block: eyebrow line
// (~15) + its top spacing (Spacing.two = 8) + bottom margin (4).
const READ_EYEBROW_HEIGHT = 27;

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
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: Spacing.two,
  },
  headerClose: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
  readFill: { flex: 1 },
  // Matches the hero meta register (competition · venue line):
  // Barlow_500Medium sm in textSecondary.
  body: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    lineHeight: BODY_LINE_HEIGHT,
    color: Colors.light.textSecondary,
  },
});
