import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixtureCarousel } from '@/components/fixture-carousel';
import { Spacing } from '@/constants/theme';

/**
 * Home. A timeline carousel of 5 fixtures — the two most-recently completed,
 * the current (live / next scheduled / last completed by fallback), and the
 * next two. Nothing else on Home for now.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <View style={styles.container}>
        <FixtureCarousel />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  container: { paddingTop: Spacing.four },
});
