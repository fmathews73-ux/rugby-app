import { Stack } from 'expo-router';

/**
 * Teams index sits at the base of this stack. Even when a team hub (or
 * a player card below it) is opened directly via a deep-link push,
 * expo-router inserts `index` underneath so the back button and the
 * "tap focused tab to pop to root" behaviour return the user to the
 * Teams directory. Same pattern as the Fixtures stack.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * Nested Stack inside the "Teams" tab. Lets `[id].tsx` (team hub) and
 * `player/[id].tsx` (player card) push onto the same tab's stack — so
 * the AppHeader + tab bar rendered by the parent (tabs)/_layout persist
 * across the whole Teams drill hierarchy.
 *
 * `headerShown: false` because the app-wide `AppHeader` is already
 * rendered by the (tabs) layout above.
 */
export default function TeamsStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
