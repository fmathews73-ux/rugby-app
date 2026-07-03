import { Stack } from 'expo-router';

/**
 * Nested Stack inside the "Fixtures" tab. Lets `[id].tsx` (fixture detail)
 * push onto the same tab's stack instead of the root Stack — so the
 * `AppHeader` + tab bar rendered by the parent (tabs)/_layout persist
 * when the user drills into a fixture.
 *
 * `headerShown: false` because the app-wide `AppHeader` is already rendered
 * by the (tabs) layout above; no per-screen native header needed here.
 */
export default function FixturesStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
