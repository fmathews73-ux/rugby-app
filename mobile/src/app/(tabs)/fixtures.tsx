import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture } from '@rugby-app/shared';

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
 * Default view (competitionFilter = "all"): the most recent completed
 * fixture at the top + every upcoming fixture below. Users switching to a
 * specific competition see ALL fixtures for that competition (including
 * older completed ones) — the filter is treated as an explicit "browse this
 * competition" action rather than a narrowing of the default feed.
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

  const sections = useMemo(() => {
    if (isLoading || error) return [];
    const compById = new Map(competitions.data?.map((c) => [c.id, c]) ?? []);
    const teamById = new Map(teams.data?.map((t) => [t.id, t]) ?? []);
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);

    let filtered: Fixture[];
    if (competitionFilter === ALL_COMPETITIONS) {
      // Default view: most recent completed + everything upcoming.
      const sortedAsc = all.slice().sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
      // The most recent completed fixture is the last one whose status is
      // "completed" — sortedAsc places completed fixtures before upcoming.
      let mostRecentCompleted: Fixture | undefined;
      for (const f of sortedAsc) {
        if (f.status === 'completed') mostRecentCompleted = f;
      }
      const upcoming = sortedAsc.filter(
        (f) =>
          f.status === 'scheduled' || f.status === 'live' || f.status === 'half-time',
      );
      filtered = mostRecentCompleted ? [mostRecentCompleted, ...upcoming] : upcoming;
    } else {
      filtered = all.filter((f) => f.competition_id === competitionFilter);
    }

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
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          const comp = section.compById.get(item.competition_id);
          const home = section.teamById.get(item.home_team_id);
          const away = section.teamById.get(item.away_team_id);
          return (
            <Pressable
              onPress={() => router.push(`/fixture/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Text style={styles.timeCol}>{item.kickoff_utc.slice(11, 16)}</Text>
              <View style={styles.mainCol}>
                <View style={styles.matchupRow}>
                  {home ? <TeamFlagBall2D flagCode={home.flag_code} size={22} /> : null}
                  <Text style={styles.matchupText}>
                    {home?.short_name ?? item.home_team_id.toUpperCase()}
                  </Text>
                  <Text style={styles.matchupSep}>·</Text>
                  {away ? <TeamFlagBall2D flagCode={away.flag_code} size={22} /> : null}
                  <Text style={styles.matchupText}>
                    {away?.short_name ?? item.away_team_id.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.metaText}>
                  {comp?.short_name ?? item.competition_id} · {item.venue}
                </Text>
              </View>
              <StatusPill status={item.status} />
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

function StatusPill({ status }: { status: Fixture['status'] }) {
  const colors: Record<Fixture['status'], { bg: string; fg: string; label: string }> = {
    scheduled: { bg: '#E5E7EB', fg: '#374151', label: 'Upcoming' },
    live: { bg: '#DC2626', fg: '#FFFFFF', label: 'LIVE' },
    'half-time': { bg: '#F59E0B', fg: '#FFFFFF', label: 'HT' },
    completed: { bg: '#111827', fg: '#F9FAFB', label: 'Final' },
    postponed: { bg: '#F59E0B', fg: '#FFFFFF', label: 'Postp.' },
    cancelled: { bg: '#9CA3AF', fg: '#FFFFFF', label: 'Cancel.' },
  };
  const c = colors[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayHeader: {
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
  matchupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchupText: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  matchupSep: { fontSize: 14, color: Colors.light.textSecondary, marginHorizontal: 2 },
  metaText: { fontSize: 11, color: Colors.light.textSecondary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
