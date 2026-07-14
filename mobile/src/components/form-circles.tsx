import { StyleSheet, Text, View } from 'react-native';

import { Colors, TextSize, TextWeight } from '@/constants/theme';
import type { FormOutcome } from '@/hooks/use-team-recent-form';

// Colour tokens re-used from the Stats leader/lagger bars — green for
// wins, red for losses. Draw uses secondary text grey.
const WIN_COLOR = '#5CB04E';
const LOSS_COLOR = '#DC2626';
const DRAW_COLOR = '#9CA3AF';

/**
 * `W L W W L` circle strip — one small filled circle per completed
 * fixture in the form window (newest → oldest). Placeholder circles pad
 * out to `lookback` slots when the team hasn't played enough matches.
 *
 * Colour: green = W, red = L, grey = D. Letter inside each circle so
 * the outcome reads even without colour perception.
 */
export function FormCircles({
  outcomes,
  lookback,
}: {
  outcomes: readonly FormOutcome[];
  lookback: number;
}) {
  const padded: (FormOutcome | null)[] = [
    ...outcomes,
    ...Array.from({ length: Math.max(0, lookback - outcomes.length) }, () => null),
  ];
  return (
    <View style={styles.row}>
      {padded.map((o, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            o === null
              ? styles.circleEmpty
              : o === 'W'
                ? { backgroundColor: WIN_COLOR }
                : o === 'L'
                  ? { backgroundColor: LOSS_COLOR }
                  : { backgroundColor: DRAW_COLOR },
          ]}>
          {o !== null ? <Text style={styles.letter}>{o}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3E8EF',
    backgroundColor: 'transparent',
  },
  letter: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.background,
  },
});
