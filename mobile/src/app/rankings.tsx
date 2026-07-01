import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Power Rankings — latest World Rugby men's snapshot across all 28 sides.
 * International rankings are stored, not computed (PRD §7). The proprietary
 * club algorithm (register #13) is deferred out of v1 scope.
 */
export default function RankingsScreen() {
  const query = useLatestRanking();
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, { name: string; short_name: string; flag_code: string }>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Power Rankings</Text>
        <Text style={styles.subtitle}>
          World Rugby men’s
          {query.data ? ` · snapshot ${query.data.snapshot_date}` : ''}
        </Text>

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data ? (
          <View style={styles.table}>
            {query.data.rows.map((row) => {
              const team = teamById.get(row.team_id);
              return (
                <View key={row.team_id} style={styles.row}>
                  <Text style={styles.rank}>{row.rank}</Text>
                  {team ? (
                    <TeamFlagBall2D flagCode={team.flag_code} size={28} />
                  ) : (
                    <View style={styles.flagFallback} />
                  )}
                  <View style={styles.teamCol}>
                    <Text style={styles.teamName}>
                      {team?.name ?? row.team_id.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.points}>{row.points}</Text>
                  <MovementBadge movement={row.movement} />
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MovementBadge({ movement }: { movement: number | null }) {
  if (movement === null) {
    return <Text style={styles.movementNew}>NEW</Text>;
  }
  if (movement === 0) {
    return <Text style={styles.movementFlat}>—</Text>;
  }
  const isUp = movement > 0;
  return (
    <Text style={[styles.movement, isUp ? styles.movementUp : styles.movementDown]}>
      {isUp ? '▲' : '▼'} {Math.abs(movement)}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.two, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: Spacing.three, textTransform: 'uppercase', letterSpacing: 0.8 },
  table: { backgroundColor: Colors.light.backgroundElement, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rank: { width: 30, fontSize: 15, fontWeight: '700', color: Colors.light.text },
  flagFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB' },
  teamCol: { flex: 1, paddingLeft: Spacing.one },
  teamName: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  points: { width: 42, textAlign: 'right', fontSize: 14, fontWeight: '600', color: Colors.light.text },
  movement: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  movementUp: { color: '#059669' },
  movementDown: { color: '#DC2626' },
  movementFlat: { width: 52, textAlign: 'right', fontSize: 14, color: Colors.light.textSecondary },
  movementNew: { width: 52, textAlign: 'right', fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary },
});
