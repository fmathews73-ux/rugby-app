import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

const UP = '#059669';
const DOWN = '#DC2626';

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
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Power Rankings</Text>
          <Text style={styles.subtitle}>
            World Rugby men’s
            {query.data ? ` · snapshot ${query.data.snapshot_date}` : ''}
          </Text>
        </View>

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data ? (
          <View style={styles.card}>
            {query.data.rows.map((row, i) => {
              const team = teamById.get(row.team_id);
              const isLast = i === query.data.rows.length - 1;
              return (
                <View
                  key={row.team_id}
                  style={[styles.row, isLast && styles.rowLast]}>
                  <Text style={styles.rank}>{row.rank}</Text>
                  <View style={styles.flagWrap}>
                    {team ? (
                      <TeamFlagBall2D flagCode={team.flag_code} size={26} />
                    ) : (
                      <View style={styles.flagFallback} />
                    )}
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team?.name ?? row.team_id.toUpperCase()}
                  </Text>
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
  if (movement === null) return <Text style={styles.movementNew}>NEW</Text>;
  if (movement === 0) return <Text style={styles.movementFlat}>—</Text>;
  const isUp = movement > 0;
  return (
    <Text style={[styles.movement, isUp ? styles.movementUp : styles.movementDown]}>
      {isUp ? '▲' : '▼'} {Math.abs(movement)}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },

  headerBlock: { gap: 4 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text },
  subtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowLast: { borderBottomWidth: 0 },
  rank: { width: 28, fontSize: 14, fontWeight: '700', color: Colors.light.text },
  flagWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  flagFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB' },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    paddingLeft: 4,
  },
  points: { width: 42, textAlign: 'right', fontSize: 14, fontWeight: '700', color: Colors.light.text },
  movement: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  movementUp: { color: UP },
  movementDown: { color: DOWN },
  movementFlat: { width: 52, textAlign: 'right', fontSize: 14, color: Colors.light.textSecondary },
  movementNew: {
    width: 52,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
});
