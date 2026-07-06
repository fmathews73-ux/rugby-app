import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, Team } from '@rugby-app/shared';

import {
  useCompetitions,
  useFixture,
  useFixtureLineups,
  useFixturePlayers,
  useFixtureResult,
  useTeams,
} from '@/api/hooks';
import { AnalysisPane } from '@/components/fixture-drill/analysis-pane';
import { LineUpPane } from '@/components/fixture-drill/lineup-pane';
import { MatchupHeader } from '@/components/fixture-drill/matchup-header';
import { OverviewPane } from '@/components/fixture-drill/overview-pane';
import { PreviewPane } from '@/components/fixture-drill/preview-pane';
import { StatsPane } from '@/components/fixture-drill/stats-pane';
import { SubTabBar, type SubTab } from '@/components/fixture-drill/sub-tab-bar';
import { PageGradient } from '@/components/page-gradient';
import { ErrorState, LoadingState } from '@/components/state-views';
import { Spacing } from '@/constants/theme';

/**
 * Fixture detail. Header shows the matchup (flag balls + team names + score
 * if completed). A horizontal sub-tab strip switches between the 5 panes
 * defined in PRD §4.3 — Overview, Line-Up, Stats, Rankings, News. Stats and
 * News are placeholders (register #12 KPI list and register #8 news source
 * are still open).
 */

export default function FixtureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<SubTab>('preview');
  const scrollRef = useRef<ScrollView>(null);

  // Every sub-tab pill tap resolves to the topmost card of that pane —
  // Preview → Form, Line-Up → Starting XV, Timeline → FT, Stats → first
  // KPI, Insights → Profile. Applies even when tapping the already-active
  // pill: a deterministic "reset to top" gesture matches the same
  // resolve-to-landmark behaviour we give the footer tab icons.
  const handleSubTabSelect = (next: SubTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const fixture = useFixture(id ?? '');
  const fixtureStatus = fixture.data?.status;
  const result = useFixtureResult(id ?? '', fixtureStatus);
  const lineups = useFixtureLineups(id ?? '', fixtureStatus);
  const players = useFixturePlayers(id ?? '');
  const teams = useTeams();
  const competitions = useCompetitions();

  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams.data ?? []) m.set(t.id, t);
    return m;
  }, [teams.data]);

  const compById = useMemo(() => {
    const m = new Map<string, { name: string; short_name: string }>();
    for (const c of competitions.data ?? []) m.set(c.id, c);
    return m;
  }, [competitions.data]);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players.data ?? []) m.set(p.id, p);
    return m;
  }, [players.data]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <PageGradient />
      <Stack.Screen options={{ title: '' }} />
      {fixture.isLoading ? (
        <LoadingState />
      ) : fixture.isError ? (
        <ErrorState error={fixture.error} />
      ) : fixture.data ? (
        // Hero + sub-tab bar sit OUTSIDE the ScrollView so they stay pinned
        // at the top of the viewport while only the pane content scrolls
        // beneath. Keeps the fixture identity and tab controls always
        // visible on long panes (Line-Up 23-row roster, Stats 30+ bars).
        <>
          <MatchupHeader
            fixture={fixture.data}
            result={result.data ?? null}
            homeTeam={teamById.get(fixture.data.home_team_id)}
            awayTeam={teamById.get(fixture.data.away_team_id)}
            competitionName={compById.get(fixture.data.competition_id)?.short_name}
          />
          <SubTabBar tab={tab} onSelect={handleSubTabSelect} />
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
            <View style={styles.pane}>
              {tab === 'preview' && (
                <PreviewPane
                  fixture={fixture.data}
                  homeTeamId={fixture.data.home_team_id}
                  awayTeamId={fixture.data.away_team_id}
                  asOfDate={fixture.data.kickoff_utc}
                />
              )}
              {tab === 'overview' && (
                <OverviewPane
                  fixture={fixture.data}
                  homeTeam={teamById.get(fixture.data.home_team_id)}
                  awayTeam={teamById.get(fixture.data.away_team_id)}
                  playerById={playerById}
                />
              )}
              {tab === 'lineup' && (
                <LineUpPane
                  fixture={fixture.data}
                  lineups={lineups.data ?? []}
                  lineupsLoading={lineups.isLoading}
                  playerById={playerById}
                />
              )}
              {tab === 'stats' && (
                <StatsPane
                  fixture={fixture.data}
                  result={result.data ?? null}
                  resultLoading={result.isLoading}
                />
              )}
              {tab === 'analysis' && (
                <AnalysisPane fixture={fixture.data} />
              )}
            </View>
          </ScrollView>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 60 },
  // gap matches the app-wide 16pt inter-card rhythm (each pane renders
  // one stack today, but any future sibling gets the standard gap).
  pane: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
});
