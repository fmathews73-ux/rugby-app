import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { CarouselPageActiveContext } from '@/components/card-carousel';
import { CHART_INK_TOTAL_MS } from '@/components/insights/use-chart-ink';
import { Colors } from '@/constants/theme';

/**
 * The card-flip affordance — one shared component so the glyph and its
 * arrival motion swap app-wide in one place. Glyph: the INFO CIRCLE
 * (owner call 2026-07-16, replacing the fingerprint — "the brand is
 * the two-tone, not the print"; the print retires to the icon/splash/
 * welcome). Matches the app's info-icon → explainer language.
 *
 * Arrival grammar unchanged: once the chart's arrival sweep has
 * finished (bars at size, count-ups landed — CHART_INK_TOTAL_MS after
 * page-activation) the glyph gives ONE breathing pulse, then repeats
 * a single pulse every 5s while the page stays visible.
 */
export function FlipTrigger({
  size = 16,
  color = Colors.light.textSecondary,
}: {
  size?: number;
  color?: string;
}) {
  const turn = useRef(new Animated.Value(0)).current;
  const pageActive = useContext(CarouselPageActiveContext);

  useEffect(() => {
    if (!pageActive) return;
    turn.setValue(0);
    const mkPulse = () =>
      Animated.sequence([
        Animated.timing(turn, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(turn, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]);
    // Wait for the chart's arrival sweep to land, pulse once, then a
    // single pulse every 5s.
    const anim = Animated.sequence([
      Animated.delay(CHART_INK_TOTAL_MS),
      mkPulse(),
      Animated.loop(Animated.sequence([Animated.delay(5000), mkPulse()])),
    ]);
    anim.start();
    return () => anim.stop();
  }, [pageActive, turn]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: turn.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) },
        ],
      }}>
      <Ionicons name="information-circle-outline" size={size} color={color} />
    </Animated.View>
  );
}
