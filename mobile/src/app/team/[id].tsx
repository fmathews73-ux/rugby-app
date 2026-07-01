import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * DIAGNOSTIC — minimal team detail. No data fetching, no 3D. If this page
 * renders when you tap a Team row, the router is fine and the previous
 * failure was in the 3D component or one of its imports (three /
 * @react-three/fiber /native / expo-gl). If this page ALSO fails to
 * render, the router is misconfigured.
 */
export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.tag}>DIAGNOSTIC</Text>
        <Text style={styles.title}>Team detail</Text>
        <Text style={styles.body}>
          route params: <Text style={styles.mono}>{id ?? '(none)'}</Text>
        </Text>
        <Text style={styles.body}>
          If you can read this, `router.push` and the Stack + Tabs config are
          working. Next step: restore the 3D flag ball with proper error
          isolation.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  tag: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  mono: { fontFamily: 'ui-monospace', color: '#111827', fontWeight: '600' },
});
