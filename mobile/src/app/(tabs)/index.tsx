import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHealth, useLatestRanking, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Home. Two cards, each split into a left-third graphic column and a
 * right-two-thirds data column. Real IA per PRD §4.3 is "General
 * description / landing" with content blocks still `[INPUT NEEDED #19]`;
 * until that lands, this dashboard shape works.
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

  const topRankedTeam = ranking.data ? teamById.get(ranking.data.rows[0]?.team_id ?? '') : undefined;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Rugby App</Text>
        <Text style={styles.subtitle}>Men’s international rugby, all in one place.</Text>

        {/* Card 1 — Live in the app */}
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="pulse" size={38} color={Colors.light.text} />
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardTitle}>Live in the app</Text>
            {health.isLoading ? (
              <LoadingState />
            ) : health.isError ? (
              <ErrorState error={health.error} />
            ) : health.data ? (
              <View style={styles.metricList}>
                <MetricRow value={health.data.entities.competitions} label="Competitions" />
                <MetricRow value={health.data.entities.teams} label="Teams" />
                <MetricRow value={health.data.entities.fixtures} label="Fixtures" />
                <MetricRow value={health.data.entities.rankings} label="Rankings" />
              </View>
            ) : null}
          </View>
        </View>

        {/* Card 2 — Latest ranking snapshot */}
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            {topRankedTeam ? (
              <TeamFlagBall2D flagCode={topRankedTeam.flag_code} size={72} />
            ) : (
              <View style={styles.iconCircle}>
                <Ionicons name="trophy" size={38} color={Colors.light.text} />
              </View>
            )}
          </View>
          <View style={styles.cardRight}>
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
                        <TeamFlagBall2D flagCode={team.flag_code} size={20} />
                      ) : (
                        <View style={styles.flagFallback} />
                      )}
                      <Text style={styles.rankTeam} numberOfLines={1}>
                        {team?.short_name ?? row.team_id.toUpperCase()}
                      </Text>
                      <Text style={styles.rankPoints}>{row.points}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View style={styles.metricRow}>
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
    flexDirection: 'row',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cardRight: {
    flex: 2,
    gap: Spacing.three,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },

  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },

  metricList: { gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two + 2 },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    minWidth: 40,
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  rankList: { gap: 6 },
  rankMeta: { fontSize: 11, color: Colors.light.textSecondary },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankIndex: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary, minWidth: 18 },
  flagFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB' },
  rankTeam: { fontSize: 13, fontWeight: '600', color: Colors.light.text, flex: 1 },
  rankPoints: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },
});
