import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * Cheap, list-safe pseudo-3D flag chip: a circle-clipped flag PNG with an SVG
 * radial-highlight overlay (top-left) and rim shadow (bottom-right). Works at
 * any size, renders instantly, safe to put in a FlatList with 30+ items.
 *
 * For hero moments (team detail page), use TeamFlagBall3D — actual sphere
 * geometry with texture-mapped flag.
 */
export function TeamFlagBall2D({
  flagCode,
  size = 40,
}: {
  flagCode: string;
  size?: number;
}) {
  const flagUrl = `https://flagcdn.com/w${resolveFlagWidth(size)}/${flagCode}.png`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: flagUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        resizeMode="cover"
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id={`hl-${flagCode}`}
            cx="30%"
            cy="25%"
            r="60%"
            fx="30%"
            fy="25%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <Stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={`sh-${flagCode}`}
            cx="70%"
            cy="80%"
            r="70%"
            fx="70%"
            fy="80%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0.35" />
            <Stop offset="80%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#sh-${flagCode})`} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#hl-${flagCode})`} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 0.5}
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

/** Pick the smallest flagcdn size ≥ 3× the render size so a Retina display gets
 * sharp textures without pulling multi-MB assets. */
function resolveFlagWidth(size: number): number {
  const target = size * 3;
  const sizes = [40, 80, 160, 320, 640, 1280];
  for (const s of sizes) if (s >= target) return s;
  return 1280;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 999,
  },
});
