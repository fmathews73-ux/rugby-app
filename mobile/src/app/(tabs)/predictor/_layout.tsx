import { Stack } from 'expo-router';

/**
 * Predictor index sits at the base of this stack — same grammar as
 * the Fixtures / Teams / Tables stacks: deep-linked drills insert
 * `index` beneath so back always walks to the predictions list.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function PredictorStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
