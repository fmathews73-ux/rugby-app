import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeasonStandings, useTeams } from '@/api/hooks';
import { CompetitionPicker } from '@/components/competition-picker';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Standings. Picker at the top selects a competition; the query switches to
 * the corresponding season. Six Nations and Rugby Championship each have a
 * single round-robin table; World Cup 2027 returns one table per pool
 * (currently all-zeros since pool matches are scheduled Oct 2027).
 * Test-window competitions have no standings and are excluded from the picker.
 */

const STANDINGS_OPTIONS = [
  { id: 'six-nations-2026', label: 'Six Nations' },
  { id: 'rugby-championship-2026', label: 'Rugby C’ship' },
  { id: 'world-cup-2027', label: 'World Cup' },
] as const;

const SEASON_TITLE: Record<string, { title: string; subtitle: string }> = {
  'six-nations-2026': { title: 'Six Nations 2026', subtitle: 'Final standings' },
  'rugby-championship-2026': { title: 'Rugby Championship 2026', subtitle: 'Kicks off Aug 2026' },
  'world-cup-2027': { title: 'Rugby World Cup 2027', subtitle: 'Pool stage · Oct 2027' },
};

export default function StandingsScreen() {
  const [seasonId, setSeasonId] = useState<string>(STANDINGS_OPTIONS[0].id);
  const query = useSeasonStandings(seasonId);
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, { name: string; short_name: string; flag_code: string }>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  const info = SEASON_TITLE[seasonId];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <CompetitionPicker
        options={STANDINGS_OPTIONS}
        selected={seasonId}
        onSelect={setSeasonId}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{info?.title ?? seasonId}</Text>
        <Text style={styles.subtitle}>{info?.subtitle ?? ''}</Text>

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data && query.data.length > 0 ? (
          query.data.map((standings) => (
            <View key={standings.id} style={styles.tableGroup}>
              {standings.group ? (
                <Text style={styles.groupHeading}>{standings.group}</Text>
              ) : null}
              <StandingsTable rows={standings.rows} teamById={teamById} />
            </View>
          ))
        ) : (
          <EmptyState label="No standings for this competition." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StandingsTable({
  rows,
  teamById,
}: {
  rows: readonly {
    team_id: string; played: number; won: number; drawn: number; lost: number;
    points_difference: number; table_points: number; rank: number;
  }[];
  teamById: Map<string, { name: string; short_name: string; flag_code: string }>;
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cellRank, styles.headerText]}>#</Text>
        <View style={styles.cellFlag} />
        <Text style={[styles.cellTeam, styles.headerText]}>Team</Text>
        <Text style={[styles.cellStat, styles.headerText]}>P</Text>
        <Text style={[styles.cellStat, styles.headerText]}>W</Text>
        <Text style={[styles.cellStat, styles.headerText]}>D</Text>
        <Text style={[styles.cellStat, styles.headerText]}>L</Text>
        <Text style={[styles.cellStat, styles.headerText]}>PD</Text>
        <Text style={[styles.cellPts, styles.headerText]}>Pts</Text>
      </View>
      {rows.map((r) => {
        const team = teamById.get(r.team_id);
        return (
          <View key={r.team_id} style={styles.row}>
            <Text style={styles.cellRank}>{r.rank}</Text>
            <View style={styles.cellFlag}>
              {team ? <TeamFlagBall2D flagCode={team.flag_code} size={22} /> : null}
            </View>
            <Text style={styles.cellTeam}>{team?.short_name ?? r.team_id.toUpperCase()}</Text>
            <Text style={styles.cellStat}>{r.played}</Text>
            <Text style={styles.cellStat}>{r.won}</Text>
            <Text style={styles.cellStat}>{r.drawn}</Text>
            <Text style={styles.cellStat}>{r.lost}</Text>
            <Text style={styles.cellStat}>
              {r.points_difference > 0 ? `+${r.points_difference}` : r.points_difference}
            </Text>
            <Text style={[styles.cellPts, styles.cellPtsValue]}>{r.table_points}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: Spacing.two },
  tableGroup: { gap: Spacing.one },
  groupHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    paddingTop: Spacing.two,
  },
  table: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 4,
  },
  headerRow: { backgroundColor: Colors.light.backgroundSelected },
  headerText: { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  cellRank: { width: 22, fontSize: 13, fontWeight: '600', color: Colors.light.text },
  cellFlag: { width: 26, alignItems: 'center' },
  cellTeam: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.light.text },
  cellStat: { width: 24, textAlign: 'center', fontSize: 12, color: Colors.light.text },
  cellPts: { width: 32, textAlign: 'right', fontSize: 14, fontWeight: '700', color: Colors.light.text },
  cellPtsValue: { color: Colors.light.text },
});
