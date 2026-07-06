import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture, Result } from '@rugby-app/shared';

import { useCompetitions, useSeasons, useTeams } from '@/api/hooks';
import { fetchJson } from '@/api/client';
import { CompetitionPicker } from '@/components/competition-picker';
import { LivePulseDot } from '@/components/live-pulse-dot';
import { PageGradient } from '@/components/page-gradient';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, PAGE_BOTTOM_INSET, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useQueries } from '@tanstack/react-query';

import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

const ALL_COMPETITIONS = 'all';

/** Horizontal page margin for the day-cards — 24pt, matching the Teams
 * directory column (and the pill strip's own inset) so the two landing
 * pages share one card column and the first pill sits flush with the
 * card edge on both. */
const HORIZONTAL_MARGIN = Spacing.four;

const FILTER_OPTIONS = [
  { id: ALL_COMPETITIONS, label: 'All' },
  { id: 'six-nations', label: 'Six Nations' },
  { id: 'rugby-championship', label: 'Rugby C’ship' },
  { id: 'summer-tests', label: 'Summer' },
  { id: 'autumn-tests', label: 'Autumn' },
  { id: 'rugby-europe-championship', label: 'Rugby Europe' },
  { id: 'pacific-nations-cup', label: 'Pacific Cup' },
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
  const navigation = useNavigation();
  const [competitionFilter, setCompetitionFilter] = useState<string>(ALL_COMPETITIONS);
  const { refreshing, onRefresh } = usePullToRefresh();

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

  // Collect the ids of fixtures that have (or might soon have) a result —
  // completed OR currently live/half-time. Live fixtures poll every 30 s
  // so the score shown inline stays fresh; completed fetch once and cache.
  const scoreFixtures = useMemo(() => {
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);
    const filtered =
      competitionFilter === ALL_COMPETITIONS
        ? all
        : all.filter((f) => f.competition_id === competitionFilter);
    return filtered.filter(
      (f) => f.status === 'completed' || f.status === 'live' || f.status === 'half-time',
    );
  }, [fixtureQueries, competitionFilter]);

  const resultQueries = useQueries({
    queries: scoreFixtures.map((f) => ({
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

  /** Day-group index of the day whose date is closest to today, whether
   *  that day sits in the past (most-recent completed) or in the future
   *  (next upcoming). Ties break toward the earlier day. Used to
   *  jump-scroll on mount and on every Fixtures tab press so the
   *  "closest to now" day-card is always the top-of-viewport landmark. */
  const closestToTodayDayIndex = useMemo((): number | null => {
    if (sections.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    let bestIndex: number | null = null;
    let bestDelta = Infinity;
    for (let s = 0; s < sections.length; s++) {
      const section = sections[s];
      if (!section || section.data.length === 0) continue;
      // All fixtures in a section share a day. Use midnight of that day
      // so evening kick-offs don't pull the comparison across a date
      // boundary.
      const dayStr = section.data[0]!.kickoff_utc.slice(0, 10);
      const dayTs = new Date(`${dayStr}T00:00:00`).getTime();
      const delta = Math.abs(dayTs - todayTs);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = s;
      }
    }
    return bestIndex;
  }, [sections]);

  type DayGroup = (typeof sections)[number];
  const listRef = useRef<FlatList<DayGroup>>(null);
  const didInitialScroll = useRef(false);

  /** Jump the list so the day-card closest to today sits at the top of
   *  the viewport. Called on first layout and on every Fixtures tab
   *  press so the same landmark rules for both entry paths. */
  const scrollToClosestToToday = useCallback(
    (animated: boolean) => {
      if (closestToTodayDayIndex === null) return;
      try {
        listRef.current?.scrollToIndex({
          index: closestToTodayDayIndex,
          viewPosition: 0,
          // Keep the 8pt hairline-to-card drop visible — without this
          // the landmark scroll pins the card flush to the strip,
          // scrolling the contentContainer's paddingTop out of view.
          viewOffset: Spacing.two,
          animated,
        });
      } catch {
        // FlatList throws if layout isn't ready — retry logic in
        // onScrollToIndexFailed below.
      }
    },
    [closestToTodayDayIndex],
  );

  useEffect(() => {
    if (
      !didInitialScroll.current &&
      closestToTodayDayIndex !== null &&
      sections.length > 0
    ) {
      // Delay lets the FlatList finish its first layout before we scroll.
      const t = setTimeout(() => {
        scrollToClosestToToday(false);
        didInitialScroll.current = true;
      }, 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [closestToTodayDayIndex, sections.length, scrollToClosestToToday]);

  // Re-snap to the closest-to-today landmark whenever this screen
  // regains focus AFTER the initial mount — i.e. when the user has
  // drilled into a fixture and returned via the back arrow. Guarded on
  // `didInitialScroll` so we don't fight the first-paint scroll above.
  // Same landmark rule applies here as for the Fixtures tab press, so
  // the list always shows the "closest to now" day-card up top
  // regardless of how the user arrived.
  useFocusEffect(
    useCallback(() => {
      if (didInitialScroll.current && closestToTodayDayIndex !== null) {
        scrollToClosestToToday(false);
      }
    }, [closestToTodayDayIndex, scrollToClosestToToday]),
  );

  // Every tap of the Fixtures tab icon — including when the tab is
  // already focused — snaps back to the day-card whose date is closest
  // to today. Consistent resolve-to landmark for Fixtures matching
  // Home's scroll-to-top.
  //
  // Since Fixtures now lives inside its own nested `<Stack>` (so fixture
  // detail can push while keeping the AppHeader + tab bar), the local
  // `useNavigation()` returns that Stack — which doesn't emit `tabPress`.
  // Walk up to the parent Tabs navigator to receive the event.
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    const unsub = parent.addListener('tabPress' as never, () => {
      scrollToClosestToToday(true);
    });
    return unsub;
  }, [navigation, scrollToClosestToToday]);

  if (isLoading) return <View style={styles.center}><LoadingState /></View>;
  if (error) return <View style={styles.center}><ErrorState error={error} /></View>;

  return (
    // No 'bottom' edge on SafeAreaView — the tab bar handles its own inset;
    // matches Home page pattern so cards scroll cleanly under the tab bar.
    // Same vertical pastel gradient as Home (sky → mint, top → bottom) sits
    // behind the picker + fixtures list; SafeAreaView is transparent so it
    // shows through.
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <PageGradient />
      <CompetitionPicker
        options={FILTER_OPTIONS}
        selected={competitionFilter}
        onSelect={setCompetitionFilter}
      />
      <FlatList<DayGroup>
        ref={listRef}
        data={sections}
        keyExtractor={(item) => item.title}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#9CA3AF"
          />
        }
        onScrollToIndexFailed={(info) => {
          // Day cards are variable-height (n fixtures per day), so a
          // hand-computed getItemLayout would silently drift the first
          // time a style constant changes. Instead: converge in two
          // steps. Jump to the average-based offset (forces the target
          // region to render), then re-run the precise index scroll on
          // the next frame batch. Lands exactly, regardless of card
          // heights.
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
          setTimeout(() => scrollToClosestToToday(false), 50);
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
                  onPress={() => router.push(`/fixtures/${fx.id}`)}
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
                    ) : fx.status === 'live' || fx.status === 'half-time' ? (
                      // Live / half-time — pulsing dot next to the label so
                      // the row reads as actively refreshing at a glance.
                      <View style={styles.statusMidLiveWrap}>
                        <LivePulseDot size={6} />
                        <Text
                          style={[styles.statusMid, statusMidExtraStyle(fx.status)]}
                          numberOfLines={1}>
                          {statusMidLabel(fx.status)}
                        </Text>
                      </View>
                    ) : (
                      // Postponed / cancelled: static status label only.
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
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    // 8pt below the pill strip's hairline to the first card — the same
    // drop Home uses between the header and the hero carousel, applied
    // on every strip-topped page (Fixtures / Teams / Standings).
    paddingTop: Spacing.two,
    paddingBottom: PAGE_BOTTOM_INSET,
    // (Previously no paddingBottom — cards scrolled under the tab bar;
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
    shadowOpacity: 0.06,
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
  // Wrapper for LIVE/HT rows so the pulse dot sits inline with the
  // status label while the 96pt slot width still matches every other row.
  statusMidLiveWrap: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statusMidLive: { color: StatusColor.live, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  statusMidHalfTime: { color: StatusColor.warning, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  metaText: { fontSize: TextSize.xs, color: Colors.light.textSecondary, textAlign: 'center' },
});
