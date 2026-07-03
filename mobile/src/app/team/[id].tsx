import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTeam, useTeams } from '@/api/hooks';
import { PageGradient } from '@/components/page-gradient';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Team detail. Hero is a `FlagSize.hero` (96 pt) 2D flag ball at the same
 * visual style as every other flag chip in the app. Below the hero: team meta
 * + recent / upcoming fixtures. Squad + stats deferred until the squad picker
 * and register #12 (KPI list) land.
 */
export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useTeam(id ?? '');
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, { name: string; flag_code: string; short_name: string }>();
    for (const t of teams.data ?? []) {
      m.set(t.id, { name: t.name, flag_code: t.flag_code, short_name: t.short_name });
    }
    return m;
  }, [teams.data]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <PageGradient />
      <Stack.Screen options={{ title: team.data?.name ?? '' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {team.isLoading ? (
          <LoadingState />
        ) : team.isError ? (
          <ErrorState error={team.error} />
        ) : team.data ? (
          <>
            <View style={styles.hero}>
              <TeamFlagBall2D flagCode={team.data.flag_code} size={FlagSize.hero} />
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
                  const opp = teamById.get(oppId);
                  return (
                    <View key={fx.id} style={styles.fixtureRow}>
                      <Text style={styles.fixtureDate}>{fx.kickoff_utc.slice(0, 10)}</Text>
                      <View style={styles.fixtureMain}>
                        <View style={styles.fixtureMatchup}>
                          {opp ? <TeamFlagBall2D flagCode={opp.flag_code} size={FlagSize.row} /> : null}
                          <Text style={styles.fixtureText}>
                            {isHome ? 'vs' : 'at'} {opp?.short_name ?? oppId.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.fixtureMeta}>{fx.venue}</Text>
                      </View>
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
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  heroName: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, textAlign: 'center' },
  heroSubtitle: { fontSize: TextSize.sm, letterSpacing: TextTracking.wide, color: Colors.light.textSecondary, textTransform: 'uppercase' },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: TextSize.sm, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide, color: Colors.light.textSecondary, textTransform: 'uppercase', paddingBottom: Spacing.one },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  fixtureDate: {
    width: 88,
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: TextWeight.semibold,
  },
  fixtureMain: { flex: 1, gap: 2 },
  fixtureMatchup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fixtureText: { fontSize: TextSize.lg, color: Colors.light.text, fontWeight: TextWeight.semibold },
  fixtureMeta: { color: Colors.light.textSecondary, fontSize: TextSize.sm },
  emptyText: { color: Colors.light.textSecondary, fontSize: TextSize.sm },
});
