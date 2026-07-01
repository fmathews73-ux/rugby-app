import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { Colors, Spacing } from '@/constants/theme';

const TIER_1_IDS = new Set(['eng', 'fra', 'ire', 'ita', 'sco', 'wal', 'arg', 'aus', 'nzl', 'rsa']);

/**
 * Teams — all 28 international sides, split by tier and sorted alphabetically
 * within tier. Row taps a stubbed detail navigation (not wired to a screen
 * yet — that's next stage).
 */
export default function TeamsScreen() {
  const query = useTeams();

  const grouped = useMemo(() => {
    if (!query.data) return null;
    const tier1: Team[] = [];
    const tier2: Team[] = [];
    for (const t of query.data) (TIER_1_IDS.has(t.id) ? tier1 : tier2).push(t);
    tier1.sort((a, b) => a.name.localeCompare(b.name));
    tier2.sort((a, b) => a.name.localeCompare(b.name));
    return { tier1, tier2 };
  }, [query.data]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : grouped ? (
        <FlatList
          data={[
            { kind: 'header' as const, label: 'Tier 1', count: grouped.tier1.length },
            ...grouped.tier1.map((t) => ({ kind: 'team' as const, team: t })),
            { kind: 'header' as const, label: 'Tier 2', count: grouped.tier2.length },
            ...grouped.tier2.map((t) => ({ kind: 'team' as const, team: t })),
          ]}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${item.label}` : `t-${item.team.id}-${i}`
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>{item.label}</Text>
                <Text style={styles.groupHeaderCount}>{item.count}</Text>
              </View>
            ) : (
              <View style={styles.teamRow}>
                <View style={[styles.crest, { backgroundColor: item.team.primary_color }]}>
                  <Text style={styles.crestLabel}>{item.team.short_name}</Text>
                </View>
                <Text style={styles.teamName}>{item.team.name}</Text>
              </View>
            )
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
  },
  groupHeaderText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: Colors.light.text, textTransform: 'uppercase' },
  groupHeaderCount: { fontSize: 12, color: Colors.light.textSecondary },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  crest: {
    width: 40, height: 40, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  crestLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  teamName: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
});
