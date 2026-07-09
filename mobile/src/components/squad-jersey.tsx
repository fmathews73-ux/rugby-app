import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { jerseyGlyphColors } from '@/lib/team-colors';

/**
 * Squad-colour meta glyphs — the Line-Up's CapsJersey treatment
 * (solid icon in the squad fill, trim-colour outline overlay for
 * white shirts) at the 12pt icon register. Jersey pairs with a caps
 * count; Man pairs with height/weight measurables.
 */
function SquadGlyph({
  teamId,
  solid,
  outline,
}: {
  teamId: string;
  solid: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
}) {
  const glyph = jerseyGlyphColors(teamId);
  if (!glyph) {
    return <Ionicons name={outline} size={12} color={Colors.light.textSecondary} />;
  }
  return (
    <View>
      <Ionicons name={solid} size={12} color={glyph.fill} />
      {glyph.border ? (
        <View style={styles.border} pointerEvents="none">
          <Ionicons name={outline} size={12} color={glyph.border} />
        </View>
      ) : null}
    </View>
  );
}

export function SquadJersey({ teamId }: { teamId: string }) {
  return <SquadGlyph teamId={teamId} solid="shirt" outline="shirt-outline" />;
}

export function SquadMan({ teamId }: { teamId: string }) {
  return <SquadGlyph teamId={teamId} solid="body" outline="body-outline" />;
}

export function SquadBarbell({ teamId }: { teamId: string }) {
  return <SquadGlyph teamId={teamId} solid="barbell" outline="barbell-outline" />;
}

/**
 * Identity-scale jersey with the player's CAP COUNT set inside the
 * shirt (owner call 2026-07-09, replacing the anonymous person
 * avatar) — caps become the player's number, worn on the jersey. The
 * count wears the match-score face; white shirts keep their trim
 * outline and set the number in the trim colour for contrast.
 */
export function CapsJerseyBadge({
  teamId,
  caps,
  size = 40,
}: {
  teamId: string;
  caps: number;
  size?: number;
}) {
  const glyph = jerseyGlyphColors(teamId);
  const numberColor = glyph ? (glyph.border ?? '#FFFFFF') : Colors.light.textSecondary;
  return (
    <View style={{ width: size, height: size }}>
      {glyph ? (
        <>
          <Ionicons name="shirt" size={size} color={glyph.fill} />
          {glyph.border ? (
            <View style={styles.border} pointerEvents="none">
              <Ionicons name="shirt-outline" size={size} color={glyph.border} />
            </View>
          ) : null}
        </>
      ) : (
        <Ionicons name="shirt-outline" size={size} color={Colors.light.textSecondary} />
      )}
      <View style={styles.badgeFill} pointerEvents="none">
        {/* Nudged into the shirt's torso — the glyph's collar shifts
            its optical centre below the box centre. */}
        <Text style={[styles.badgeCaps, { color: numberColor, fontSize: size * 0.33 }]}>
          {caps}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  border: { position: 'absolute', top: 0, left: 0 },
  badgeFill: {
    position: 'absolute',
    top: '14%',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCaps: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
  },
});
