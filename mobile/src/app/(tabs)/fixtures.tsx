import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture, Result } from '@rugby-app/shared';

import { useCompetitions, useSeasons, useTeams } from '@/api/hooks';
import { fetchJson } from '@/api/client';
import { CompetitionPicker } from '@/components/competition-picker';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';
import { useQueries } from '@tanstack/react-query';

const ALL_COMPETITIONS = 'all';

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

  /** Section+item indices of the most recent completed fixture in the current
   * `sections` structure — used to jump-scroll on mount so that fixture is
   * the top visible row. Iterates from the end backwards to grab the LAST
   * completed fixture (i.e., the most recent). */
  const mostRecentCompletedLocation = useMemo((): {
    sectionIndex: number;
    itemIndex: number;
  } | null => {
    for (let s = sections.length - 1; s >= 0; s--) {
      const section = sections[s];
      if (!section) continue;
      for (let i = section.data.length - 1; i >= 0; i--) {
        const fx = section.data[i];
        if (fx && fx.status === 'completed') {
          return { sectionIndex: s, itemIndex: i };
        }
      }
    }
    return null;
  }, [sections]);

  const listRef = useRef<SectionList<Fixture, { title: string; data: Fixture[]; compById: Map<string, { short_name: string }>; teamById: Map<string, { flag_code: string; short_name: string }> }>>(null);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (
      !didInitialScroll.current &&
      mostRecentCompletedLocation !== null &&
      sections.length > 0
    ) {
      // Delay lets the SectionList finish its first layout before we scroll.
      const t = setTimeout(() => {
        try {
          listRef.current?.scrollToLocation({
            sectionIndex: mostRecentCompletedLocation.sectionIndex,
            itemIndex: mostRecentCompletedLocation.itemIndex,
            viewPosition: 0, // top of viewport
            animated: false,
          });
          didInitialScroll.current = true;
        } catch {
          // SectionList throws if layout isn't ready — try once more.
        }
      }, 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mostRecentCompletedLocation, sections.length]);

  if (isLoading) return <View style={styles.center}><LoadingState /></View>;
  if (error) return <View style={styles.center}><ErrorState error={error} /></View>;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <CompetitionPicker
        options={FILTER_OPTIONS}
        selected={competitionFilter}
        onSelect={setCompetitionFilter}
      />
      <SectionList<
        Fixture,
        {
          title: string;
          data: Fixture[];
          compById: Map<string, { short_name: string }>;
          teamById: Map<string, { flag_code: string; short_name: string }>;
        }
      >
        ref={listRef}
        sections={sections}
        onScrollToIndexFailed={() => {
          // Fallback: retry after a tick when getItemLayout isn't cheap.
          setTimeout(() => {
            if (mostRecentCompletedLocation) {
              listRef.current?.scrollToLocation({
                sectionIndex: mostRecentCompletedLocation.sectionIndex,
                itemIndex: mostRecentCompletedLocation.itemIndex,
                viewPosition: 0,
                animated: false,
              });
            }
          }, 100);
        }}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={Colors.light.textSecondary}
            />
            <Text style={styles.dayHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          const comp = section.compById.get(item.competition_id);
          const home = section.teamById.get(item.home_team_id);
          const away = section.teamById.get(item.away_team_id);
          const isCompleted = item.status === 'completed';
          const result = isCompleted ? resultByFixture.get(item.id) : undefined;
          return (
            <Pressable
              onPress={() => router.push(`/fixture/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Text style={styles.timeCol}>{item.kickoff_utc.slice(11, 16)}</Text>
              <View style={styles.mainCol}>
                <View style={styles.matchupRow}>
                  <View style={styles.flagWrap}>
                    {home ? <TeamFlagBall2D flagCode={home.flag_code} size={22} /> : null}
                  </View>
                  <Text style={styles.teamCode}>
                    {home?.short_name ?? item.home_team_id.toUpperCase()}
                  </Text>
                  {result ? (
                    <Text style={styles.scoreText}>
                      {result.home_score} - {result.away_score}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.statusMid, statusMidExtraStyle(item.status)]}
                      numberOfLines={1}>
                      {statusMidLabel(item.status)}
                    </Text>
                  )}
                  <Text style={styles.teamCode}>
                    {away?.short_name ?? item.away_team_id.toUpperCase()}
                  </Text>
                  <View style={styles.flagWrap}>
                    {away ? <TeamFlagBall2D flagCode={away.flag_code} size={22} /> : null}
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {comp?.short_name ?? item.competition_id} · {item.venue}
                </Text>
              </View>
            </Pressable>
          );
        }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Text shown in the middle slot of the matchup row for non-completed
 * fixtures. Completed fixtures show the score itself instead. */
function statusMidLabel(status: Fixture['status']): string {
  const labels: Record<Fixture['status'], string> = {
    scheduled: 'Upcoming',
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
  safe: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.background,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dayHeaderText: { fontSize: 12, fontWeight: '600', letterSpacing: 1, color: Colors.light.textSecondary, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowPressed: { backgroundColor: Colors.light.backgroundElement },
  timeCol: { width: 52, fontSize: 13, fontWeight: '600', color: Colors.light.text },
  mainCol: { flex: 1, gap: 4 },
  matchupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  flagWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  teamCode: {
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  scoreText: {
    width: 76,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  statusMid: {
    width: 76,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.3,
  },
  statusMidLive: { color: '#DC2626', fontWeight: '700', letterSpacing: 1 },
  statusMidHalfTime: { color: '#F59E0B', fontWeight: '700', letterSpacing: 1 },
  metaText: { fontSize: 11, color: Colors.light.textSecondary, textAlign: 'center' },
});
