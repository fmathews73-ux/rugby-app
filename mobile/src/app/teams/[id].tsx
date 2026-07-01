import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTeam, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall3D } from '@/components/team-flag-ball-3d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Team detail. 3D flag ball hero, then upcoming and recent fixtures.
 * Squad + stats deferred until the squad picker + register #12 (KPI list) land.
 */
export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useTeam(id ?? '');
  const teams = useTeams(); // to resolve opponent flag codes

  const teamsById = useMemo(() => {
    const m = new Map<string, { name: string; flag_code: string; short_name: string }>();
    for (const t of teams.data ?? []) {
      m.set(t.id, { name: t.name, flag_code: t.flag_code, short_name: t.short_name });
    }
    return m;
  }, [teams.data]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <Stack.Screen options={{ title: team.data?.name ?? 'Team' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {team.isLoading ? (
          <LoadingState />
        ) : team.isError ? (
          <ErrorState error={team.error} />
        ) : team.data ? (
          <>
            <View style={styles.heroContainer}>
              <TeamFlagBall3D flagCode={team.data.flag_code} size={240} />
              <Text style={styles.heroName}>{team.data.name}</Text>
              <Text style={styles.heroSubtitle}>{team.data.short_name}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent & upcoming</Text>
              {team.data.fixtures.length === 0 ? (
                <Text style={styles.emptyText}>No fixtures scheduled.</Text>
              ) : (
                team.data.fixtures.slice(0, 20).map((fx) => {
                  const isHome = fx.home_team_id === id;
                  const oppId = isHome ? fx.away_team_id : fx.home_team_id;
                  const opp = teamsById.get(oppId);
                  return (
                    <View key={fx.id} style={styles.fixtureRow}>
                      <Text style={styles.fixtureDate}>{fx.kickoff_utc.slice(0, 10)}</Text>
                      <Text style={styles.fixtureText}>
                        {isHome ? 'vs' : 'at'} {opp?.short_name ?? oppId.toUpperCase()}
                        {' — '}
                        <Text style={styles.fixtureMeta}>{fx.venue}</Text>
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: 40 },
  heroContainer: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  heroName: { fontSize: 28, fontWeight: '700', color: Colors.light.text },
  heroSubtitle: { fontSize: 13, letterSpacing: 1.4, color: Colors.light.textSecondary, textTransform: 'uppercase' },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: Colors.light.textSecondary, textTransform: 'uppercase' },
  fixtureRow: {
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 2,
  },
  fixtureDate: { fontSize: 11, color: Colors.light.textSecondary, letterSpacing: 0.8 },
  fixtureText: { fontSize: 15, color: Colors.light.text },
  fixtureMeta: { color: Colors.light.textSecondary, fontSize: 13 },
  emptyText: { color: Colors.light.textSecondary, fontSize: 13 },
});
