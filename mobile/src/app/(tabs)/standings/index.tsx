import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeasonStandings, useTeams } from '@/api/hooks';
import { CardHeaderActions } from '@/components/card-header-actions';
import { CardTitle } from '@/components/card-title';
import { CompetitionPicker } from '@/components/competition-picker';
import { FadeCard, NarrativeBack, BackStrong } from '@/components/narrative-flip-card';
import { PageGradient } from '@/components/page-gradient';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { PAGE_BOTTOM_INSET, Colors, FlagSize, ScoreBoxSize, Spacing, TextSize, TextTracking } from '@/constants/theme';

/**
 * Standings on the app-wide row-geometry law (design-system §9): each
 * team is a two-band row — rank · shield · code anchors, the W/D/L
 * trio absolute-centred in the row score register, table points as
 * the right-side headline value — with the played/points-difference
 * story on the meta line. The spreadsheet grid (column headers, stat
 * cells) is retired; the fingerprint flips to the table-points
 * explainer.
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

const TABLE_ABOUT = (
  <>
    Each row is a team’s tournament ledger — wins, draws and losses in the
    score boxes, with the <BackStrong>table points</BackStrong> that decide
    the standings on the right. Table points are not match points: a win is
    worth <BackStrong>4</BackStrong> and a draw <BackStrong>2</BackStrong>,
    and bonus points are added on top — one for scoring four or more tries
    in a match, one for losing by seven or fewer. The line beneath each row
    carries matches played and <BackStrong>points difference</BackStrong>{' '}
    (points scored minus conceded), the first tie-breaker when teams finish
    level.
  </>
);

interface StandingsRow {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points_difference: number;
  table_points: number;
  rank: number;
}

type TeamLite = { name: string; short_name: string; flag_code: string };

export default function StandingsScreen() {
  const [seasonId, setSeasonId] = useState<string>(STANDINGS_OPTIONS[0].id);
  const query = useSeasonStandings(seasonId);
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, TeamLite>();
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
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data && query.data.length > 0 ? (
          query.data.map((standings) => (
            <StandingsCard
              key={standings.id}
              title={standings.group ?? info?.title ?? seasonId}
              seasonId={seasonId}
              rows={standings.rows}
              teamById={teamById}
            />
          ))
        ) : (
          <EmptyState label="No standings for this competition." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StandingsCard({
  title,
  seasonId,
  rows,
  teamById,
}: {
  title: string;
  seasonId: string;
  rows: readonly StandingsRow[];
  teamById: Map<string, TeamLite>;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <FadeCard
      flipped={flipped}
      front={
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CardTitle title={title} />
            <View style={styles.headerActions}>
              <CardHeaderActions
                onExplain={() => setFlipped(true)}
                accessibilityLabel="Explain the standings table"
              />
            </View>
          </View>
          <View style={styles.insetDivider} />
          {rows.map((r, i) => (
            <Fragment key={r.team_id}>
              <TableRow row={r} team={teamById.get(r.team_id)} seasonId={seasonId} />
              {i < rows.length - 1 ? <View style={styles.insetDivider} /> : null}
            </Fragment>
          ))}
        </View>
      }
      back={
        <NarrativeBack
          title={title}
          purpose={TABLE_ABOUT}
          onClose={() => setFlipped(false)}
        />
      }
    />
  );
}

function TableRow({
  row,
  team,
  seasonId,
}: {
  row: StandingsRow;
  team: TeamLite | undefined;
  seasonId: string;
}) {
  const router = useRouter();
  const pd = row.points_difference;
  const pdLabel = pd > 0 ? `+${pd}` : `${pd}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${team?.name ?? row.team_id} matches in this competition`}
      // Rows drill into the team-in-competition match list (owner
      // call 2026-07-11) — the evidence behind the W/D/L record,
      // scoped to the competition being read.
      onPress={() =>
        router.push({
          pathname: '/standings/team/[id]',
          params: { id: row.team_id, season: seasonId },
        })
      }>
      <View style={styles.matchupRow}>
        <View style={styles.leftWing}>
          <Text style={styles.rankText}>{row.rank}</Text>
          <View style={styles.flagWrap}>
            {team ? <TeamFlagShield flagCode={team.flag_code} width={FlagSize.row} /> : null}
          </View>
          <Text style={styles.teamCode}>{team?.short_name ?? row.team_id.toUpperCase()}</Text>
        </View>
        {/* W/D/L trio absolute-centred over the row (§9: variable-width
            wings must never drag a flexed middle off-centre). */}
        <View style={styles.middle}>
          <View style={[styles.scoreBoxSmall, styles.scoreBoxSmallWinner]}>
            <Text style={[styles.scoreBoxSmallText, styles.scoreBoxSmallTextWinner]}>
              {row.won}
              <Text style={[styles.unitText, styles.scoreBoxSmallTextWinner]}> W</Text>
            </Text>
          </View>
          <View style={[styles.scoreBoxSmall, styles.scoreBoxSmallDraw]}>
            <Text style={styles.scoreBoxSmallText}>
              {row.drawn}
              <Text style={styles.unitText}> D</Text>
            </Text>
          </View>
          <View style={styles.scoreBoxSmall}>
            <Text style={styles.scoreBoxSmallText}>
              {row.lost}
              <Text style={styles.unitText}> L</Text>
            </Text>
          </View>
        </View>
        <View style={styles.rightWing}>
          <Text style={styles.ptsText}>{row.table_points}</Text>
          <Text style={styles.ptsUnit}>PTS</Text>
        </View>
        <View style={styles.rowChevron}>
          <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
        </View>
      </View>
      <Text style={styles.metaText}>
        {row.played} played · {pdLabel} points difference
      </Text>
    </Pressable>
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
  // Centred title + status meta in-flow (the fixtures date-header
  // pattern); the fingerprint cluster rides absolute at the right,
  // centred on the title line.
  cardHeader: {
    position: 'relative',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 2,
  },
  headerActions: {
    position: 'absolute',
    right: Spacing.three,
    top: Spacing.three,
  },
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },

  row: {
    // Fixture-row rhythm: 24pt sides, 16pt vertical, 8pt band gap
    // (owner call 2026-07-13, was 4).
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rowPressed: { backgroundColor: Colors.light.backgroundElement },
  matchupRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Chevron lane — the pts cluster stops here; the chevron rides
    // into the row's 24pt padding like the fixtures rows.
    paddingRight: 18,
  },
  leftWing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rightWing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rankText: {
    // Rank is identity data — the condensed face in black.
    width: 20,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  flagWrap: {
    width: FlagSize.row,
    height: FlagSize.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCode: {
    // 24pt-shield rule: sport-display face at lg beside row shields.
    width: 40,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  middle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scoreBoxSmall: {
    ...ScoreBoxSize.row,
    minWidth: ScoreBoxSize.row.width + 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  scoreBoxSmallWinner: { backgroundColor: Colors.light.textSecondary },
  // Draw tile: white with the chrome hairline-grey keyline — its own
  // state between the dark W and quiet L (teams-row parity).
  scoreBoxSmallDraw: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7CBD1',
  },
  scoreBoxSmallText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  unitText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 7,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  ptsText: {
    // Headline value of a standings table — code register, black.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.text,
  },
  ptsUnit: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 7,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  rowChevron: {
    position: 'absolute',
    right: -Spacing.two,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
