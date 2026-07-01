import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeasonStandings } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Standings — Six Nations 2026 by default. Six Nations is the only current-
 * season round-robin competition that has completed fixtures at the sim's
 * "today" date (2026-07-01), so it renders a fully-populated table.
 *
 * Rugby Championship 2026 and RWC 2027 pool tables exist in the API too and
 * would render with zero rows until their fixtures play — deferred to a later
 * stage when a competition picker gets added.
 */
export default function StandingsScreen() {
  const query = useSeasonStandings('six-nations-2026');

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Six Nations 2026</Text>
        <Text style={styles.subtitle}>Final standings</Text>

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data && query.data[0] ? (
          <StandingsTable rows={query.data[0].rows} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StandingsTable({
  rows,
}: {
  rows: readonly {
    team_id: string; played: number; won: number; drawn: number; lost: number;
    points_difference: number; table_points: number; rank: number;
  }[];
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cellRank, styles.headerText]}>#</Text>
        <Text style={[styles.cellTeam, styles.headerText]}>Team</Text>
        <Text style={[styles.cellStat, styles.headerText]}>P</Text>
        <Text style={[styles.cellStat, styles.headerText]}>W</Text>
        <Text style={[styles.cellStat, styles.headerText]}>D</Text>
        <Text style={[styles.cellStat, styles.headerText]}>L</Text>
        <Text style={[styles.cellStat, styles.headerText]}>PD</Text>
        <Text style={[styles.cellPts, styles.headerText]}>Pts</Text>
      </View>
      {rows.map((r) => (
        <View key={r.team_id} style={styles.row}>
          <Text style={styles.cellRank}>{r.rank}</Text>
          <Text style={styles.cellTeam}>{r.team_id.toUpperCase()}</Text>
          <Text style={styles.cellStat}>{r.played}</Text>
          <Text style={styles.cellStat}>{r.won}</Text>
          <Text style={styles.cellStat}>{r.drawn}</Text>
          <Text style={styles.cellStat}>{r.lost}</Text>
          <Text style={styles.cellStat}>{r.points_difference > 0 ? `+${r.points_difference}` : r.points_difference}</Text>
          <Text style={[styles.cellPts, styles.cellPtsValue]}>{r.table_points}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: Spacing.two },
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
  },
  headerRow: { backgroundColor: Colors.light.backgroundSelected },
  headerText: { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  cellRank: { width: 26, fontSize: 13, fontWeight: '600', color: Colors.light.text },
  cellTeam: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.light.text },
  cellStat: { width: 28, textAlign: 'center', fontSize: 13, color: Colors.light.text },
  cellPts: { width: 36, textAlign: 'right', fontSize: 14, fontWeight: '700', color: Colors.light.text },
  cellPtsValue: { color: Colors.light.text },
});
