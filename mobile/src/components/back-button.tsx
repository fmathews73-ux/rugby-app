import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Standard back button for detail screens. Circular grey tile with a left
 * chevron in primary text colour — matches the design system's neutral
 * palette and avoids the iOS-blue chevron + "Fixtures" back title default.
 *
 * Wire in as `headerLeft: () => <BackButton />` on any Stack.Screen that
 * has a back destination.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel="Back">
      <Ionicons name="arrow-back" size={20} color={Colors.light.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.light.backgroundSelected,
  },
});
