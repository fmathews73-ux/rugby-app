import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture, Result } from '@rugby-app/shared';

import { useCompetitions, useSeasons, useTeams } from '@/api/hooks';
import { fetchJson } from '@/api/client';
import { CompetitionPicker } from '@/components/competition-picker';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useQueries } from '@tanstack/react-query';

const ALL_COMPETITIONS = 'all';

/** Horizontal page margin for the day-cards — matches Home cards
 * (FixtureCarousel / HomeRankingsCarousel / MyTeamCard) so cards align
 * across tabs. Only viable now that the fixed left-hand time column has
 * been dropped: the time / FT lives in the middle slot instead, so the
 * row's total content width fits comfortably in a 40pt-margin card. */
const HORIZONTAL_MARGIN = 40;

const FILTER_OPTIONS = [
  { id: ALL_COMPETITIONS, label: 'All' },
  { id: 'six-nations', label: 'Six Nations' },
  { id: 'rugby-championship', label: 'Rugby C’ship' },
  { id: 'summer-tests', label: 'Summer' },
  { id: 'autumn-tests', label: 'Autumn' },
  { id: 'world-cup', label: 'World Cup' },
] as const;

/**
 * Fixtures — every fixture across the five current-season competitions,
 * grouped by date, chronologically. Picker at the top filters by competition.
 * Tap a row → fixture detail.
 *
 * On first mount the list scrolls itself so the most recent completed
 * fixture is the top visible row. Users can scroll UP from there to see
 * everything already completed, or DOWN to see upcoming — nothing is
 * filtered out.
 */
export default function FixturesScreen() {
  const router = useRouter();
  const [competitionFilter, setCompetitionFilter] = useState<string>(ALL_COMPETITIONS);

  const competitions = useCompetitions();
  const seasons = useSeasons();
  const teams = useTeams();

  const seasonIds = useMemo(() => seasons.data?.map((s) => s.id) ?? [], [seasons.data]);

  const fixtureQueries = useQueries({
    queries: seasonIds.map((sid) => ({
      queryKey: ['seasonFixtures', sid],
      queryFn: () => fetchJson<Fixture[]>(`/seasons/${sid}/fixtures`),
    })),
  });

  const isLoading = competitions.isLoading || seasons.isLoading || fixtureQueries.some((q) => q.isLoading);
  const error = competitions.error ?? seasons.error ?? fixtureQueries.find((q) => q.error)?.error;

  // Collect the ids of completed fixtures visible in the current view so we
  // can batch-fetch their results and show the score inline.
  const completedIds = useMemo(() => {
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);
    const filtered =
      competitionFilter === ALL_COMPETITIONS
        ? all
        : all.filter((f) => f.competition_id === competitionFilter);
    return filtered.filter((f) => f.status === 'completed').map((f) => f.id);
  }, [fixtureQueries, competitionFilter]);

  const resultQueries = useQueries({
    queries: completedIds.map((id) => ({
      queryKey: ['fixtureResult', id],
      queryFn: () => fetchJson<Result>(`/fixtures/${id}/result`),
    })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) {
      if (q.data) m.set(q.data.fixture_id, q.data);
    }
    return m;
  }, [resultQueries]);

  const sections = useMemo(() => {
    if (isLoading || error) return [];
    const compById = new Map(competitions.data?.map((c) => [c.id, c]) ?? []);
    const teamById = new Map(teams.data?.map((t) => [t.id, t]) ?? []);
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);
    const filtered =
      competitionFilter === ALL_COMPETITIONS
        ? all
        : all.filter((f) => f.competition_id === competitionFilter);
    const byDate = new Map<string, Fixture[]>();
    for (const fx of filtered) {
      const day = fx.kickoff_utc.slice(0, 10);
      const arr = byDate.get(day) ?? [];
      arr.push(fx);
      byDate.set(day, arr);
    }
    const days = [...byDate.keys()].sort();
    return days.map((day) => ({
      title: formatDay(day),
      data: (byDate.get(day) ?? []).slice().sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
      compById,
      teamById,
    }));
  }, [isLoading, error, competitions.data, teams.data, fixtureQueries, competitionFilter]);

  /** Day-group index of the day that contains the most recent completed
   * fixture. Used to jump-scroll on mount so that day-card sits at the top
   * of the viewport. Iterates from the end backwards to grab the LAST
   * completed fixture (i.e., the most recent) and returns its day. */
  const mostRecentCompletedDayIndex = useMemo((): number | null => {
    for (let s = sections.length - 1; s >= 0; s--) {
      const section = sections[s];
      if (!section) continue;
      for (let i = section.data.length - 1; i >= 0; i--) {
        const fx = section.data[i];
        if (fx && fx.status === 'completed') return s;
      }
    }
    return null;
  }, [sections]);

  type DayGroup = (typeof sections)[number];
  const listRef = useRef<FlatList<DayGroup>>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (
      !didInitialScroll.current &&
      mostRecentCompletedDayIndex !== null &&
      sections.length > 0
    ) {
      // Delay lets the FlatList finish its first layout before we scroll.
      const t = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({
            index: mostRecentCompletedDayIndex,
            viewPosition: 0, // top of viewport
            animated: false,
          });
          didInitialScroll.current = true;
        } catch {
          // FlatList throws if layout isn't ready — retry logic in
          // onScrollToIndexFailed below.
        }
      }, 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mostRecentCompletedDayIndex, sections.length]);

  if (isLoading) return <View style={styles.center}><LoadingState /></View>;
  if (error) return <View style={styles.center}><ErrorState error={error} /></View>;

  return (
    // No 'bottom' edge on SafeAreaView — the tab bar handles its own inset;
    // matches Home page pattern so cards scroll cleanly under the tab bar.
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <View style={styles.pickerWrap}>
        <CompetitionPicker
          options={FILTER_OPTIONS}
          selected={competitionFilter}
          onSelect={setCompetitionFilter}
        />
      </View>
      <FlatList<DayGroup>
        ref={listRef}
        data={sections}
        keyExtractor={(item) => item.title}
        contentContainerStyle={styles.listContent}
        onScrollToIndexFailed={() => {
          // Retry once when getItemLayout isn't cheap enough at first paint.
          setTimeout(() => {
            if (mostRecentCompletedDayIndex !== null) {
              listRef.current?.scrollToIndex({
                index: mostRecentCompletedDayIndex,
                viewPosition: 0,
                animated: false,
              });
            }
          }, 100);
        }}
        renderItem={({ item: dayGroup }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={Colors.light.textSecondary}
              />
              <Text style={styles.cardHeaderText}>{dayGroup.title}</Text>
            </View>
            {dayGroup.data.map((fx, i) => {
              const comp = dayGroup.compById.get(fx.competition_id);
              const home = dayGroup.teamById.get(fx.home_team_id);
              const away = dayGroup.teamById.get(fx.away_team_id);
              const isCompleted = fx.status === 'completed';
              const result = isCompleted ? resultByFixture.get(fx.id) : undefined;
              const isLast = i === dayGroup.data.length - 1;
              return (
                <Pressable
                  key={fx.id}
                  onPress={() => router.push(`/fixture/${fx.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}>
                  <View style={styles.matchupRow}>
                    <View style={styles.flagWrap}>
                      {home ? <TeamFlagBall2D flagCode={home.flag_code} size={FlagSize.row} /> : null}
                    </View>
                    <Text style={styles.teamCode}>
                      {home?.short_name ?? fx.home_team_id.toUpperCase()}
                    </Text>
                    {result ? (
                      // Completed: score-FT-score cluster (FT sits between the
                      // two score boxes, replacing the fixed left-hand time column).
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
                    ) : fx.status === 'scheduled' ? (
                      // Upcoming: show the kickoff time in the middle slot
                      // (replaces the previous "Upcoming" badge).
                      <Text style={styles.timeMid}>{fx.kickoff_utc.slice(11, 16)}</Text>
                    ) : (
                      // Live / half-time / postponed / cancelled: keep the
                      // status label.
                      <Text
                        style={[styles.statusMid, statusMidExtraStyle(fx.status)]}
                        numberOfLines={1}>
                        {statusMidLabel(fx.status)}
                      </Text>
                    )}
                    <Text style={styles.teamCode}>
                      {away?.short_name ?? fx.away_team_id.toUpperCase()}
                    </Text>
                    <View style={styles.flagWrap}>
                      {away ? <TeamFlagBall2D flagCode={away.flag_code} size={FlagSize.row} /> : null}
                    </View>
                  </View>
                  <Text style={styles.metaText}>
                    {comp?.short_name ?? fx.competition_id} · {fx.venue}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Text shown in the middle slot for live / half-time / postponed / cancelled
 * fixtures. Completed fixtures render a score cluster (with FT between)
 * and scheduled fixtures render the kickoff time — neither reaches here. */
function statusMidLabel(status: Fixture['status']): string {
  const labels: Record<Fixture['status'], string> = {
    scheduled: '', // not reached — time renders instead
    live: 'LIVE',
    'half-time': 'HT',
    completed: '', // not reached — score renders instead
    postponed: 'Postp.',
    cancelled: 'Cancel.',
  };
  return labels[status];
}

function statusMidExtraStyle(status: Fixture['status']) {
  if (status === 'live') return styles.statusMidLive;
  if (status === 'half-time') return styles.statusMidHalfTime;
  return undefined;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerWrap: {
    // Match card horizontal margin so the picker aligns with card edges below.
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    // No paddingBottom — cards scroll cleanly under the tab bar, matching
    // the Home page pattern.
    gap: Spacing.three,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    // No inner padding on the card itself — the header + rows own their own
    // padding so the row divider hairlines can span the full card width.
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cardHeaderText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  row: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: 4,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowPressed: { backgroundColor: Colors.light.backgroundElement },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flagWrap: { width: FlagSize.row, height: FlagSize.row, alignItems: 'center', justifyContent: 'center' },
  teamCode: {
    width: 40,
    textAlign: 'center',
    fontSize: TextSize.md,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },
  // Fixed-width middle slot so the flags on either side stay at the same
  // horizontal position row-to-row regardless of what's in the middle
  // (completed score cluster / kickoff time / status label).
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
  scoreBoxSmallWinner: { backgroundColor: Colors.light.text },
  scoreBoxSmallText: { fontSize: TextSize.md, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  scoreBoxSmallTextWinner: { color: Colors.light.textInverse },
  ftLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  timeMid: {
    width: 96,
    textAlign: 'center',
    fontSize: TextSize.md,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  statusMid: {
    width: 96,
    textAlign: 'center',
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
  },
  statusMidLive: { color: StatusColor.live, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  statusMidHalfTime: { color: StatusColor.warning, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  metaText: { fontSize: TextSize.xs, color: Colors.light.textSecondary, textAlign: 'center' },
});
