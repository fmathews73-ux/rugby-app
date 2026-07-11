import { Stack } from 'expo-router';

/**
 * Tables index sits at the base of this stack. Even when a team-in-
 * competition drill is opened directly via a deep-link push,
 * expo-router inserts `index` underneath so the back button and the
 * "tap focused tab to pop to root" behaviour return the user to the
 * standings. Same pattern as the Fixtures and Teams stacks.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function StandingsStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
