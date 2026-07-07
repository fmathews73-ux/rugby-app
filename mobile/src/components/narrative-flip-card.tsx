import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Flip-card container — the card's info icon flips it to a narrative
 * back face (metric purpose + the live read) instead of opening a
 * modal, keeping the insight physically attached to its evidence.
 * Pure rotateY transform on the native driver (no layout animation).
 */
export function FlipCard({
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
  const anim = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: flipped ? 1 : 0,
      duration: 420,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [flipped, anim]);

  const frontRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View style={style}>
      <Animated.View
        style={[
          styles.face,
          { transform: [{ perspective: 1000 }, { rotateY: frontRot }] },
        ]}
        pointerEvents={flipped ? 'none' : 'auto'}>
        {front}
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          styles.backFace,
          { transform: [{ perspective: 1000 }, { rotateY: backRot }] },
        ]}
        pointerEvents={flipped ? 'auto' : 'none'}>
        {back}
      </Animated.View>
    </View>
  );
}

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
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>
      {/* NO scrolling — the narrative must fit the card's footprint.
          That cap is deliberate (owner rule): prose stays focused and
          to the point, or it gets cut. */}
      <View style={styles.backBody}>
        <Text style={styles.eyebrow}>What this shows</Text>
        <Text style={styles.body}>{purpose}</Text>
        {/* Read block only renders when a narrative feed exists —
            explainer-only backs (Stats categories) omit it. */}
        {read !== undefined ? (
          <>
            <Text style={[styles.eyebrow, styles.eyebrowSpaced]}>The read</Text>
            <Text style={styles.body}>{read ?? 'Analysing…'}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Bold span for use inside `purpose` copy. */
export function BackStrong({ children }: { children: ReactNode }) {
  return <Text style={strongStyle}>{children}</Text>;
}

const strongStyle = { fontWeight: '700' as const, color: '#FFFFFF' };

const styles = StyleSheet.create({
  // flexGrow with the default auto basis: the face keeps the front
  // card's NATURAL content height (the carousel's equal-height pass
  // measures it exactly as it measured the bare card), and only grows
  // when the carousel stretches siblings. flex:1 (basis 0) breaks that
  // measurement and inflates cards past their content.
  face: {
    flexGrow: 1,
    backfaceVisibility: 'hidden',
  },
  backFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backCard: {
    flex: 1,
    // Winning-score grey — the back face shares the score tiles' fill.
    backgroundColor: Colors.light.textSecondary,
    borderRadius: 12,
    padding: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  title: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  backBody: { flex: 1, overflow: 'hidden' },
  eyebrow: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.xs,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: Spacing.one,
  },
  eyebrowSpaced: { marginTop: Spacing.two },
  body: {
    fontSize: TextSize.sm,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.92)',
  },
});
