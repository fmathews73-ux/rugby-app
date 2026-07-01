import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

const TIER_1_IDS = new Set(['eng', 'fra', 'ire', 'ita', 'sco', 'wal', 'arg', 'aus', 'nzl', 'rsa']);

/**
 * Teams — all 28 international sides, split by tier and sorted alphabetically
 * within tier. Tap a row → team detail with the 3D flag ball.
 */
export default function TeamsScreen() {
  const router = useRouter();
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
              <Pressable
                style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}
                onPress={() => router.push(`/teams/${item.team.id}`)}>
                <TeamFlagBall2D flagCode={item.team.flag_code} size={44} />
                <View style={styles.teamText}>
                  <Text style={styles.teamName}>{item.team.name}</Text>
                  <Text style={styles.teamShort}>{item.team.short_name}</Text>
                </View>
              </Pressable>
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
    paddingVertical: Spacing.two + 4,
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  teamRowPressed: { backgroundColor: Colors.light.backgroundElement },
  teamText: { flex: 1, gap: 2 },
  teamName: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  teamShort: { fontSize: 11, letterSpacing: 1, color: Colors.light.textSecondary },
});
