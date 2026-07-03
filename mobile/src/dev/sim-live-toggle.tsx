import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useSimLive } from '@/dev/sim-live';

/**
 * Dev-mode floating toggle to start / stop the synthetic-live simulator
 * on the currently-open fixture. Renders only in `__DEV__` builds and
 * only for completed fixtures (the sim rewinds a completed match to
 * minute 0 and plays it out at ~8× speed — no point offering it on a
 * scheduled fixture that has no result to slice).
 *
 * When active, the toggle shows the current virtual minute so it's
 * obvious the sim is running. Tap to stop.
 *
 * Placement: bottom of the fixture-drill scroll pane. Absolute-
 * positioned at the top-right of its parent so it doesn't crowd the
 * event content and stays reachable while scrolling.
 */
export function SimLiveToggle({ fixture }: { fixture: Fixture }) {
  const sim = useSimLive();
  if (!__DEV__) return null;
  if (fixture.status !== 'completed') return null;

  const isThisFixture = sim.active && sim.fixtureId === fixture.id;
  const minuteLabel = Math.floor(sim.virtualMinute);

  if (isThisFixture) {
    return (
      <Pressable
        onPress={sim.stop}
        style={({ pressed }) => [styles.button, styles.buttonActive, pressed && styles.pressed]}
        accessibilityLabel="Stop live simulator">
        <View style={styles.dot} />
        <Text style={styles.labelActive}>SIM · {minuteLabel}'</Text>
        <Ionicons name="stop" size={12} color={Colors.light.background} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => sim.start(fixture.id)}
      style={({ pressed }) => [styles.button, styles.buttonIdle, pressed && styles.pressed]}
      accessibilityLabel="Start live simulator on this fixture">
      <Ionicons name="play" size={12} color={Colors.light.textSecondary} />
      <Text style={styles.labelIdle}>SIM LIVE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
  buttonIdle: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  buttonActive: {
    backgroundColor: StatusColor.live,
  },
  pressed: { opacity: 0.7 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.background,
  },
  labelIdle: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  labelActive: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.background,
    fontVariant: ['tabular-nums'],
  },
});
