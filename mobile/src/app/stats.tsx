import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

/**
 * Stats — the premium-gated surface (PRD §8). Content is deliberately absent
 * until register #12 (explicit stats/KPI field list, INPUT NEEDED — Phase 2)
 * is resolved. Client-side gating is a placeholder; server-side entitlement
 * enforcement is the source of truth (see `services/api` guardrail comment).
 */
export default function StatsScreen() {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PREMIUM</Text>
        </View>
        <Text style={styles.title}>Deep player stats</Text>
        <Text style={styles.body}>
          The full stats surface unlocks once the KPI field list is finalised (PRD
          register #12) and subscription flow lands (Phase 6). Until then, this tab
          is a placeholder — nothing rendered from the synthetic dataset.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  badge: {
    borderWidth: 1,
    borderColor: '#B45309',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#B45309', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.light.text, textAlign: 'center' },
  body: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
});
