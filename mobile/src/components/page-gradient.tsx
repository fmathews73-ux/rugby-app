import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/**
 * Shared full-bleed background gradient for every tab screen + detail
 * screen. Single source of truth for the app-wide "page background" so
 * a colour tweak here propagates everywhere without touching individual
 * screens.
 *
 * Rendered as the first child of the outer SafeAreaView / root View so
 * subsequent siblings (the ScrollView + its cards) render on top via
 * natural DOM order. Uses explicit inset-based absolute positioning —
 * Fabric renderers can drop `StyleSheet.absoluteFillObject` on the
 * native gradient view without the explicit `left/right/top/bottom: 0`.
 *
 * Gradient direction is a vertical `top → bottom` fade. To rotate 90°
 * counter-clockwise from a CSS `linear-gradient(90deg, A, B)` spec:
 * pass `A` as the SECOND colour and `B` as the FIRST — the swap moves
 * `A` (originally on the left) down to the bottom, and `B` to the top.
 */
// BI aesthetic — flat off-white page background, no gradient. Keeping the
// component (and expo-linear-gradient) around so a gradient can be
// reintroduced with a one-line swap if we change direction; today it just
// renders both stops at the same value → visually flat.
const COLORS = ['#FAFAFA', '#FAFAFA'] as const;

export function PageGradient() {
  return (
    <LinearGradient
      colors={COLORS as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    />
  );
}

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
