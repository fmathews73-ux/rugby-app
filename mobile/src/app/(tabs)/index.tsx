import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHealth, useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Home. Deliberately dashboard-like at this stage — real IA per PRD §4.3 is
 * "General description/landing" with content blocks still `[INPUT NEEDED #19]`.
 * Until that's specified, this shows a rugby-agnostic pipeline health card
 * + a rankings tease with 2D flag balls.
 */
export default function HomeScreen() {
  const health = useHealth();
  const ranking = useLatestRanking();
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, { name: string; flag_code: string; short_name: string }>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Rugby App</Text>
        <Text style={styles.subtitle}>Men’s international rugby, all in one place.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live in the app</Text>
          {health.isLoading ? (
            <LoadingState />
          ) : health.isError ? (
            <ErrorState error={health.error} />
          ) : health.data ? (
            <View style={styles.metricsRow}>
              <Metric label="Competitions" value={health.data.entities.competitions} />
              <Metric label="Teams" value={health.data.entities.teams} />
              <Metric label="Fixtures" value={health.data.entities.fixtures} />
              <Metric label="Rankings" value={health.data.entities.rankings} />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Latest ranking snapshot</Text>
          {ranking.isLoading ? (
            <LoadingState />
          ) : ranking.isError ? (
            <ErrorState error={ranking.error} />
          ) : ranking.data ? (
            <View style={styles.rankList}>
              <Text style={styles.rankMeta}>{ranking.data.snapshot_date}</Text>
              {ranking.data.rows.slice(0, 5).map((row) => {
                const team = teamById.get(row.team_id);
                return (
                  <View key={row.team_id} style={styles.rankRow}>
                    <Text style={styles.rankIndex}>{row.rank}.</Text>
                    {team ? (
                      <TeamFlagBall2D flagCode={team.flag_code} size={26} />
                    ) : (
                      <View style={styles.flagFallback} />
                    )}
                    <Text style={styles.rankTeam}>
                      {team?.name ?? row.team_id.toUpperCase()}
                    </Text>
                    <Text style={styles.rankPoints}>{row.points} pts</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value ?? '–'}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 14, color: Colors.light.textSecondary },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, color: Colors.light.textSecondary },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'space-between' },
  metric: { flexBasis: '45%', gap: 4 },
  metricValue: { fontSize: 26, fontWeight: '700', color: Colors.light.text },
  metricLabel: { fontSize: 12, color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  rankList: { gap: 8 },
  rankMeta: { fontSize: 12, color: Colors.light.textSecondary },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rankIndex: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary, minWidth: 22 },
  flagFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB' },
  rankTeam: { fontSize: 15, fontWeight: '600', color: Colors.light.text, flex: 1 },
  rankPoints: { fontSize: 12, color: Colors.light.textSecondary },
});
