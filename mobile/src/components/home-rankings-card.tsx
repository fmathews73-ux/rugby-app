import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

const ACCENT = '#4F46E5';
const UP = '#059669';
const DOWN = '#DC2626';

/**
 * Compact preview of the World Rugby men's rankings for the Home page.
 * Shows the top 5 teams from the latest snapshot; tapping the "See all"
 * footer pushes to the full Rankings tab.
 */
export function HomeRankingsCard() {
  const router = useRouter();
  const ranking = useLatestRanking();
  const teams = useTeams();

  const teamById = useMemo(
    () =>
      new Map(
        (teams.data ?? []).map((t) => [
          t.id,
          { name: t.name, short_name: t.short_name, flag_code: t.flag_code },
        ]),
      ),
    [teams.data],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>World Rugby Rankings</Text>
        {ranking.data ? (
          <Text style={styles.subtitle}>Men’s · Snapshot {ranking.data.snapshot_date}</Text>
        ) : null}
      </View>

      {ranking.isLoading ? (
        <LoadingState />
      ) : ranking.isError ? (
        <ErrorState error={ranking.error} />
      ) : ranking.data ? (
        <View style={styles.list}>
          {ranking.data.rows.slice(0, 5).map((row) => {
            const team = teamById.get(row.team_id);
            return (
              <View key={row.team_id} style={styles.row}>
                <Text style={styles.rank}>{row.rank}</Text>
                {team ? (
                  <TeamFlagBall2D flagCode={team.flag_code} size={22} />
                ) : (
                  <View style={styles.flagFallback} />
                )}
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

      <Pressable
        onPress={() => router.push('/rankings')}
        style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}>
        <Text style={styles.footerText}>See all rankings</Text>
        <Ionicons name="chevron-forward" size={16} color={ACCENT} />
      </Pressable>
    </View>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: Spacing.three,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rank: {
    width: 18,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  flagFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.light.text },
  points: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
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

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Spacing.two,
  },
  footerPressed: { opacity: 0.5 },
  footerText: { fontSize: 13, fontWeight: '700', color: ACCENT, letterSpacing: 0.2 },
});
