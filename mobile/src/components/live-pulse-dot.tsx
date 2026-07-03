import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { StatusColor } from '@/constants/theme';

/**
 * Small red dot that gently pulses to signal a live data connection.
 * Used in the LIVE indicator on the Home fixture carousel, the Fixture
 * drill hero pill, and the Fixtures list row. A slow, low-contrast
 * pulse (0.4 → 1.0 opacity over ~1.2 s each way) reads as "the data
 * you're seeing is refreshing" without becoming distracting on the
 * static parts of the page.
 *
 * Rendering separate animated instances is cheap — each uses a single
 * `Animated.Value` driven by a native-driver loop — and lets us drop
 * one wherever a live status appears without wiring shared timers.
 */
export function LivePulseDot({
  size = 7,
  color,
}: {
  size?: number;
  /** Override the dot's fill colour. Defaults to `StatusColor.live` (red)
   *  — pass a light colour (e.g. `Colors.light.background`) when placing
   *  the dot inside a red-filled pill, otherwise it's invisible. */
  color?: string;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          ...(color ? { backgroundColor: color } : {}),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: StatusColor.live,
  },
});
