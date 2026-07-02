import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

const TIER_1_IDS = new Set(['eng', 'fra', 'ire', 'ita', 'sco', 'wal', 'arg', 'aus', 'nzl', 'rsa']);

/**
 * Teams — all 28 international sides, split by tier and sorted alphabetically
 * within tier. Tap a row → team detail.
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
          data={buildListData(grouped.tier1, grouped.tier2)}
          keyExtractor={(item, i) => (item.kind === 'header' ? `h-${item.label}` : `t-${item.team.id}-${i}`)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupHeaderText}>{item.label}</Text>
                  <Text style={styles.groupHeaderCount}>{item.count}</Text>
                </View>
              );
            }
            const isFirst = item.position === 'first' || item.position === 'only';
            const isLast = item.position === 'last' || item.position === 'only';
            return (
              <Pressable
                onPress={() => router.push(`/team/${item.team.id}`)}
                style={({ pressed }) => [
                  styles.teamRow,
                  isFirst && styles.teamRowFirst,
                  isLast && styles.teamRowLast,
                  pressed && styles.teamRowPressed,
                ]}>
                <TeamFlagBall2D flagCode={item.team.flag_code} size={FlagSize.medium} />
                <View style={styles.teamText}>
                  <Text style={styles.teamName}>{item.team.name}</Text>
                  <Text style={styles.teamShort}>{item.team.short_name}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

type ListItem =
  | { kind: 'header'; label: string; count: number }
  | { kind: 'team'; team: Team; position: 'first' | 'middle' | 'last' | 'only' };

/** Build a flat list-item stream that includes tier headers + team rows.
 * position on each team row is used to draw only the leading/trailing
 * hairlines correctly inside its containing card. */
function buildListData(tier1: Team[], tier2: Team[]): ListItem[] {
  const items: ListItem[] = [];
  const pushGroup = (label: string, teams: Team[]) => {
    items.push({ kind: 'header', label, count: teams.length });
    teams.forEach((t, i) =>
      items.push({
        kind: 'team',
        team: t,
        position:
          teams.length === 1
            ? 'only'
            : i === 0
              ? 'first'
              : i === teams.length - 1
                ? 'last'
                : 'middle',
      }),
    );
  };
  pushGroup('Tier 1', tier1);
  pushGroup('Tier 2', tier2);
  return items;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  listContent: { padding: Spacing.four, paddingBottom: 40, gap: Spacing.one + 2 },

  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two - 2,
  },
  groupHeaderText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  groupHeaderCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  teamRowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  teamRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  teamRowPressed: { backgroundColor: '#F3F4F6' },
  teamText: { flex: 1, gap: 2 },
  teamName: { fontSize: TextSize.lg, fontWeight: TextWeight.semibold, color: Colors.light.text },
  teamShort: { fontSize: TextSize.xs, letterSpacing: TextTracking.wide, color: Colors.light.textSecondary, fontWeight: TextWeight.semibold },
});
