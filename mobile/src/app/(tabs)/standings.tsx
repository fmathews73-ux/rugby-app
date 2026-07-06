import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeasonStandings, useTeams } from '@/api/hooks';
import { CompetitionPicker } from '@/components/competition-picker';
import { PageGradient } from '@/components/page-gradient';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { PAGE_BOTTOM_INSET, Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

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
  { id: 'rugby-europe-championship-2026', label: 'Rugby Europe' },
  { id: 'pacific-nations-cup-2026', label: 'Pacific Cup' },
  { id: 'world-cup-2027', label: 'World Cup' },
] as const;

const SEASON_TITLE: Record<string, { title: string; subtitle: string }> = {
  'six-nations-2026': { title: 'Six Nations 2026', subtitle: 'Final standings' },
  'rugby-championship-2026': { title: 'Rugby Championship 2026', subtitle: 'Kicks off Aug 2026' },
  'rugby-europe-championship-2026': { title: 'Rugby Europe Championship 2026', subtitle: 'Final standings' },
  'pacific-nations-cup-2026': { title: 'Pacific Nations Cup 2026', subtitle: 'Kicks off Aug 2026' },
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
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <CompetitionPicker
        options={STANDINGS_OPTIONS}
        selected={seasonId}
        onSelect={setSeasonId}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{info?.title ?? seasonId}</Text>
          <Text style={styles.subtitle}>{info?.subtitle ?? ''}</Text>
        </View>

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
    <View style={styles.card}>
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
      {rows.map((r, i) => {
        const team = teamById.get(r.team_id);
        const isLast = i === rows.length - 1;
        return (
          <View key={r.team_id} style={[styles.row, isLast && styles.rowLast]}>
            <Text style={styles.cellRank}>{r.rank}</Text>
            <View style={styles.cellFlag}>
              {team ? <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.row} /> : null}
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
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
    // 8pt drop from the pill strip's hairline — matches Home's
    // header-to-hero gap and the Fixtures / Teams pages.
    paddingTop: Spacing.two,
    paddingBottom: PAGE_BOTTOM_INSET,
    gap: Spacing.three,
  },

  headerBlock: { gap: 4 },
  title: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text },
  subtitle: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    fontWeight: TextWeight.semibold,
  },

  tableGroup: { gap: Spacing.one + 2 },
  groupHeading: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    paddingTop: Spacing.two,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    gap: 4,
  },
  rowLast: { borderBottomWidth: 0 },
  headerRow: {
    backgroundColor: '#F9FAFB',
    borderBottomColor: '#E5E7EB',
  },
  headerText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  cellRank: { width: 22, fontSize: TextSize.sm, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  cellFlag: { width: 26, alignItems: 'center', justifyContent: 'center' },
  cellTeam: { flex: 1, fontSize: TextSize.sm, fontWeight: TextWeight.bold, color: Colors.light.text },
  cellStat: { width: 24, textAlign: 'center', fontSize: TextSize.sm, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  cellPts: { width: 32, textAlign: 'right', fontSize: TextSize.md, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  cellPtsValue: { color: Colors.light.text },
});
