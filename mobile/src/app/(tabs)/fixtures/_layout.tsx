import { Stack } from 'expo-router';

/**
 * Fixtures index sits at the base of this stack. Even when a fixture
 * detail is opened directly via a deep-link push (e.g. `router.push(
 * '/fixtures/<id>')` from Home's My Team Matches card), expo-router
 * inserts `index` underneath so the back button and the "tap focused
 * tab to pop to root" behaviour naturally return the user to the
 * Fixtures list.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

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
