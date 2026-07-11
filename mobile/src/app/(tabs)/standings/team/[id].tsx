import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture, Result } from '@rugby-app/shared';

import { useSeasonFixtures, useTeams } from '@/api/hooks';
import { fetchJson } from '@/api/client';
import { CardTitle } from '@/components/card-title';
import { LivePulseDot } from '@/components/live-pulse-dot';
import { PageGradient } from '@/components/page-gradient';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { formatKickoffTime } from '@/lib/format-fixture-date';
import { Colors, FlagSize, PAGE_BOTTOM_INSET, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking } from '@/constants/theme';
import { useQueries } from '@tanstack/react-query';

/**
 * Team-in-competition drill — the evidence behind a standings row.
 * Pushed from a table row with `?season=`; shows every one of the
 * team's fixtures in THAT competition, split into a Completed card
 * and an Upcoming card, in the fixtures-list row grammar. Tapping a
 * match pushes the fixture drill.
 */

type TeamLite = { name: string; short_name: string; flag_code: string };

export default function StandingsTeamScreen() {
  const { id: teamId, season: seasonId } = useLocalSearchParams<{ id: string; season: string }>();
  const fixtures = useSeasonFixtures(seasonId);
  const teams = useTeams();

  const teamById = useMemo(() => {
    const m = new Map<string, TeamLite>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  const teamFixtures = useMemo(
    () =>
      (fixtures.data ?? [])
        .filter((f) => f.home_team_id === teamId || f.away_team_id === teamId)
        .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    [fixtures.data, teamId],
  );

  const completed = teamFixtures.filter(
    (f) => f.status === 'completed' || f.status === 'live' || f.status === 'half-time',
  );
  const upcoming = teamFixtures.filter(
    (f) => f.status !== 'completed' && f.status !== 'live' && f.status !== 'half-time',
  );

  const resultQueries = useQueries({
    queries: completed.map((f) => ({
      queryKey: ['fixtureResult', f.id],
      queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
      refetchInterval:
        f.status === 'live' || f.status === 'half-time' ? 30_000 : false,
    })),
  });
  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) {
      if (q.data) m.set(q.data.fixture_id, q.data);
    }
    return m;
  }, [resultQueries]);

  const isLoading = fixtures.isLoading || teams.isLoading;
  const error = fixtures.error ?? teams.error;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : teamFixtures.length === 0 ? (
          <EmptyState label="No fixtures for this team in this competition." />
        ) : (
          <>
            {completed.length > 0 ? (
              <MatchesCard
                title="Completed"
                fixtures={completed}
                teamById={teamById}
                resultByFixture={resultByFixture}
              />
            ) : null}
            {upcoming.length > 0 ? (
              <MatchesCard
                title="Upcoming"
                fixtures={upcoming}
                teamById={teamById}
                resultByFixture={resultByFixture}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchesCard({
  title,
  fixtures,
  teamById,
  resultByFixture,
}: {
  title: string;
  fixtures: Fixture[];
  teamById: Map<string, TeamLite>;
  resultByFixture: Map<string, Result>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <CardTitle title={title} />
      </View>
      <View style={styles.insetDivider} />
      {fixtures.map((fx, i) => (
        <Fragment key={fx.id}>
          <MatchRow fx={fx} teamById={teamById} result={resultByFixture.get(fx.id)} />
          {i < fixtures.length - 1 ? <View style={styles.insetDivider} /> : null}
        </Fragment>
      ))}
    </View>
  );
}

function MatchRow({
  fx,
  teamById,
  result,
}: {
  fx: Fixture;
  teamById: Map<string, TeamLite>;
  result: Result | undefined;
}) {
  const router = useRouter();
  const home = teamById.get(fx.home_team_id);
  const away = teamById.get(fx.away_team_id);

  const dateLabel = new Date(fx.kickoff_utc).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Pressable
      // Match pages open INSIDE the Tables stack (standings/fixture/
      // [id] re-export) so back returns here, not to the Fixtures tab.
      onPress={() => router.push(`/standings/fixture/${fx.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${home?.short_name ?? fx.home_team_id} versus ${away?.short_name ?? fx.away_team_id} match page`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.matchupRow}>
        <View style={styles.flagWrap}>
          {home ? <TeamFlagShield flagCode={home.flag_code} width={FlagSize.row} /> : null}
        </View>
        <Text style={styles.teamCode}>{home?.short_name ?? fx.home_team_id.toUpperCase()}</Text>
        {result && fx.status === 'completed' ? (
          <View style={styles.middleCompleted}>
            <View
              style={[
                styles.scoreBoxSmall,
                result.home_score > result.away_score && styles.scoreBoxSmallWinner,
              ]}>
              <Text
                style={[
                  styles.scoreBoxSmallText,
                  result.home_score > result.away_score && styles.scoreBoxSmallTextWinner,
                ]}>
                {result.home_score}
              </Text>
            </View>
            <Text style={styles.ftLabel}>FT</Text>
            <View
              style={[
                styles.scoreBoxSmall,
                result.away_score > result.home_score && styles.scoreBoxSmallWinner,
              ]}>
              <Text
                style={[
                  styles.scoreBoxSmallText,
                  result.away_score > result.home_score && styles.scoreBoxSmallTextWinner,
                ]}>
                {result.away_score}
              </Text>
            </View>
          </View>
        ) : fx.status === 'live' || fx.status === 'half-time' ? (
          <View style={styles.statusMidLiveWrap}>
            <LivePulseDot size={6} />
            <Text style={[styles.statusMid, fx.status === 'live' ? styles.statusMidLive : styles.statusMidHalfTime]} numberOfLines={1}>
              {fx.status === 'live' ? 'LIVE' : 'HT'}
            </Text>
          </View>
        ) : fx.status === 'scheduled' ? (
          <Text style={styles.timeMid}>{formatKickoffTime(fx.kickoff_utc)}</Text>
        ) : (
          <Text style={styles.statusMid} numberOfLines={1}>
            {fx.status === 'postponed' ? 'Postp.' : 'Cancel.'}
          </Text>
        )}
        <Text style={styles.teamCode}>{away?.short_name ?? fx.away_team_id.toUpperCase()}</Text>
        <View style={styles.flagWrap}>
          {away ? <TeamFlagShield flagCode={away.flag_code} width={FlagSize.row} /> : null}
        </View>
        <View style={styles.rowChevron}>
          <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
        </View>
      </View>
      <Text style={styles.metaText}>
        {dateLabel} · {fx.venue}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    paddingHorizontal: Spacing.four,
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
  cardHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },

  row: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: 4,
  },
  rowPressed: { backgroundColor: Colors.light.backgroundElement },
  matchupRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
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
  middleCompleted: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scoreBoxSmall: {
    ...ScoreBoxSize.row,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoxSmallWinner: { backgroundColor: Colors.light.textSecondary },
  scoreBoxSmallText: {
    fontSize: TextSize.lg,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    color: Colors.light.textSecondary,
  },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  ftLabel: {
    fontSize: TextSize.sm,
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  timeMid: {
    width: 96,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  statusMid: {
    width: 96,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  statusMidLive: { color: StatusColor.live },
  statusMidHalfTime: { color: StatusColor.warning },
  statusMidLiveWrap: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
