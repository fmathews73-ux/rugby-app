import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture } from '@rugby-app/shared';

import { useCompetitions, useSeasons } from '@/api/hooks';
import { fetchJson } from '@/api/client';
import { ErrorState, LoadingState } from '@/components/state-views';
import { Colors, Spacing } from '@/constants/theme';
import { useQueries } from '@tanstack/react-query';

/**
 * Fixtures — every fixture across the four current-season competitions,
 * grouped by date (upcoming first, past below). Each row: kickoff time,
 * competition, and the two teams.
 */
export default function FixturesScreen() {
  const competitions = useCompetitions();
  const seasons = useSeasons();

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
    const all: Fixture[] = fixtureQueries.flatMap((q) => q.data ?? []);
    const byDate = new Map<string, Fixture[]>();
    for (const fx of all) {
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
    }));
  }, [isLoading, error, competitions.data, fixtureQueries]);

  if (isLoading) return <View style={styles.center}><LoadingState /></View>;
  if (error) return <View style={styles.center}><ErrorState error={error} /></View>;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <SectionList<Fixture, { title: string; data: Fixture[]; compById: Map<string, { short_name: string }> }>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          const comp = section.compById.get(item.competition_id);
          return (
            <View style={styles.row}>
              <Text style={styles.timeCol}>{item.kickoff_utc.slice(11, 16)}</Text>
              <View style={styles.mainCol}>
                <Text style={styles.matchupText}>
                  {item.home_team_id.toUpperCase()} · {item.away_team_id.toUpperCase()}
                </Text>
                <Text style={styles.metaText}>
                  {comp?.short_name ?? item.competition_id} · {item.venue}
                </Text>
              </View>
              <StatusPill status={item.status} />
            </View>
          );
        }}
        stickySectionHeadersEnabled
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
  timeCol: { width: 52, fontSize: 13, fontWeight: '600', color: Colors.light.text },
  mainCol: { flex: 1, gap: 2 },
  matchupText: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  metaText: { fontSize: 12, color: Colors.light.textSecondary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
