import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Fixture, LineUp, Result, Team } from '@rugby-app/shared';

import {
  useCompetitions,
  useFixture,
  useFixtureLineups,
  useFixtureResult,
  useLatestRanking,
  useTeams,
} from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, Spacing } from '@/constants/theme';

/**
 * Fixture detail. Header shows the matchup (flag balls + team names + score
 * if completed). A horizontal sub-tab strip switches between the 5 panes
 * defined in PRD §4.3 — Overview, Line-Up, Stats, Rankings, News. Stats and
 * News are placeholders (register #12 KPI list and register #8 news source
 * are still open).
 */

type SubTab = 'overview' | 'lineup' | 'stats' | 'rankings' | 'news';

const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'lineup', label: 'Line-Up' },
  { id: 'stats', label: 'Stats' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'news', label: 'News' },
];

export default function FixtureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<SubTab>('overview');

  const fixture = useFixture(id ?? '');
  const result = useFixtureResult(id ?? '');
  const lineups = useFixtureLineups(id ?? '');
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: '' }} />
      {fixture.isLoading ? (
        <LoadingState />
      ) : fixture.isError ? (
        <ErrorState error={fixture.error} />
      ) : fixture.data ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <MatchupHeader
            fixture={fixture.data}
            result={result.data ?? null}
            homeTeam={teamById.get(fixture.data.home_team_id)}
            awayTeam={teamById.get(fixture.data.away_team_id)}
            competitionName={compById.get(fixture.data.competition_id)?.short_name}
          />
          <SubTabBar tab={tab} onSelect={setTab} />
          <View style={styles.pane}>
            {tab === 'overview' && (
              <OverviewPane
                fixture={fixture.data}
                result={result.data ?? null}
                resultLoading={result.isLoading}
              />
            )}
            {tab === 'lineup' && (
              <LineUpPane
                fixture={fixture.data}
                lineups={lineups.data ?? []}
                lineupsLoading={lineups.isLoading}
                teamById={teamById}
              />
            )}
            {tab === 'stats' && <PremiumPlaceholder title="Deep player stats" />}
            {tab === 'rankings' && (
              <RankingsPane
                homeTeamId={fixture.data.home_team_id}
                awayTeamId={fixture.data.away_team_id}
                teamById={teamById}
              />
            )}
            {tab === 'news' && (
              <ComingSoonPlaceholder
                title="Match news"
                body="News source is still an open item (PRD register #8). Nothing to render until it's decided."
              />
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Matchup header ──────────────────────────────────────────────────────────

function MatchupHeader({
  fixture,
  result,
  homeTeam,
  awayTeam,
  competitionName,
}: {
  fixture: Fixture;
  result: Result | null;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  competitionName: string | undefined;
}) {
  const isCompleted = fixture.status === 'completed';
  return (
    <View style={styles.header}>
      <Text style={styles.headerMeta}>
        {competitionName ?? fixture.competition_id}
        {fixture.round ? ` · ${fixture.round}` : ''}
      </Text>
      <View style={styles.matchupRow}>
        <TeamCol team={homeTeam} teamId={fixture.home_team_id} />
        <View style={styles.scoreCol}>
          {isCompleted && result ? (
            <Text style={styles.score}>
              {result.home_score} – {result.away_score}
            </Text>
          ) : (
            <Text style={styles.vsMuted}>vs</Text>
          )}
          <StatusPill status={fixture.status} />
        </View>
        <TeamCol team={awayTeam} teamId={fixture.away_team_id} />
      </View>
      <Text style={styles.headerLine}>{formatKickoff(fixture.kickoff_utc)}</Text>
      <Text style={styles.headerLine}>{fixture.venue}</Text>
    </View>
  );
}

function TeamCol({ team, teamId }: { team: Team | undefined; teamId: string }) {
  return (
    <View style={styles.teamCol}>
      {team ? <TeamFlagBall2D flagCode={team.flag_code} size={56} /> : null}
      <Text style={styles.teamShort}>{team?.short_name ?? teamId.toUpperCase()}</Text>
      <Text style={styles.teamName} numberOfLines={1}>
        {team?.name ?? teamId}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: Fixture['status'] }) {
  const config: Record<Fixture['status'], { bg: string; fg: string; label: string }> = {
    scheduled: { bg: '#E5E7EB', fg: '#374151', label: 'Upcoming' },
    live: { bg: '#DC2626', fg: '#FFFFFF', label: 'LIVE' },
    'half-time': { bg: '#F59E0B', fg: '#FFFFFF', label: 'HALF-TIME' },
    completed: { bg: '#111827', fg: '#F9FAFB', label: 'Final' },
    postponed: { bg: '#F59E0B', fg: '#FFFFFF', label: 'Postponed' },
    cancelled: { bg: '#9CA3AF', fg: '#FFFFFF', label: 'Cancelled' },
  };
  const c = config[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────

function SubTabBar({ tab, onSelect }: { tab: SubTab; onSelect: (t: SubTab) => void }) {
  return (
    <View style={styles.subTabBarWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subTabBarInner}>
        {SUB_TABS.map((t) => (
          <Pressable key={t.id} onPress={() => onSelect(t.id)} style={styles.subTabPress}>
            <Text style={[styles.subTabLabel, tab === t.id && styles.subTabLabelActive]}>
              {t.label}
            </Text>
            {tab === t.id ? <View style={styles.subTabUnderline} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Overview pane ───────────────────────────────────────────────────────────

function OverviewPane({
  fixture,
  result,
  resultLoading,
}: {
  fixture: Fixture;
  result: Result | null;
  resultLoading: boolean;
}) {
  if (fixture.status !== 'completed') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Match hasn’t kicked off yet. Overview will populate once the fixture is complete.
        </Text>
      </View>
    );
  }
  if (resultLoading) return <LoadingState />;
  if (!result) {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>No result on file for this fixture.</Text>
      </View>
    );
  }
  return (
    <View style={styles.statsGrid}>
      <StatRow
        label="Half-time"
        values={[`${result.half_time_home}`, `${result.half_time_away}`]}
      />
      <StatRow label="Tries" values={[`${result.home_tries}`, `${result.away_tries}`]} />
      <StatRow
        label="Conversions"
        values={[`${result.home_conversions}`, `${result.away_conversions}`]}
      />
      <StatRow
        label="Penalties"
        values={[`${result.home_penalties}`, `${result.away_penalties}`]}
      />
      <StatRow
        label="Drop goals"
        values={[`${result.home_drop_goals}`, `${result.away_drop_goals}`]}
      />
    </View>
  );
}

function StatRow({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{values[0] ?? ''}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, styles.statValueRight]}>{values[1] ?? ''}</Text>
    </View>
  );
}

// ─── Line-Up pane ────────────────────────────────────────────────────────────

function LineUpPane({
  fixture,
  lineups,
  lineupsLoading,
  teamById,
}: {
  fixture: Fixture;
  lineups: LineUp[];
  lineupsLoading: boolean;
  teamById: Map<string, Team>;
}) {
  if (fixture.status === 'scheduled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Line-ups are typically published shortly before kickoff. Nothing to show yet.
        </Text>
      </View>
    );
  }
  if (lineupsLoading) return <LoadingState />;
  if (lineups.length === 0) {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>No line-ups recorded for this fixture.</Text>
      </View>
    );
  }
  return (
    <View style={styles.lineupContainer}>
      {lineups.map((lu) => {
        const t = teamById.get(lu.team_id);
        return (
          <View key={lu.team_id} style={styles.lineupTeamBlock}>
            <View style={styles.lineupTeamHeader}>
              {t ? <TeamFlagBall2D flagCode={t.flag_code} size={22} /> : null}
              <Text style={styles.lineupTeamName}>{t?.name ?? lu.team_id.toUpperCase()}</Text>
            </View>
            <Text style={styles.lineupSectionLabel}>Starting XV</Text>
            {lu.starting_xv.map((e) => (
              <View key={e.player_id} style={styles.lineupRow}>
                <Text style={styles.lineupNumber}>{e.shirt_number}</Text>
                <Text style={styles.lineupPos}>{e.position}</Text>
              </View>
            ))}
            <Text style={styles.lineupSectionLabel}>Bench</Text>
            {lu.bench.map((e) => (
              <View key={e.player_id} style={styles.lineupRow}>
                <Text style={styles.lineupNumber}>{e.shirt_number}</Text>
                <Text style={styles.lineupPos}>{e.position}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Rankings pane ───────────────────────────────────────────────────────────

function RankingsPane({
  homeTeamId,
  awayTeamId,
  teamById,
}: {
  homeTeamId: string;
  awayTeamId: string;
  teamById: Map<string, Team>;
}) {
  const ranking = useLatestRanking();
  if (ranking.isLoading) return <LoadingState />;
  if (ranking.isError) return <ErrorState error={ranking.error} />;
  if (!ranking.data) return null;

  const home = ranking.data.rows.find((r) => r.team_id === homeTeamId);
  const away = ranking.data.rows.find((r) => r.team_id === awayTeamId);

  return (
    <View style={styles.rankingsPane}>
      <Text style={styles.rankingsMeta}>
        World Rugby men’s · snapshot {ranking.data.snapshot_date}
      </Text>
      <RankingCard team={teamById.get(homeTeamId)} row={home} />
      <RankingCard team={teamById.get(awayTeamId)} row={away} />
    </View>
  );
}

function RankingCard({
  team,
  row,
}: {
  team: Team | undefined;
  row: { rank: number; points: number; movement: number | null } | undefined;
}) {
  if (!row) return null;
  return (
    <View style={styles.rankingCard}>
      <View style={styles.rankingLead}>
        {team ? <TeamFlagBall2D flagCode={team.flag_code} size={34} /> : null}
        <View>
          <Text style={styles.rankingName}>{team?.name ?? '—'}</Text>
          <Text style={styles.rankingSub}>Rank {row.rank}</Text>
        </View>
      </View>
      <View style={styles.rankingTrail}>
        <Text style={styles.rankingPoints}>{row.points}</Text>
        <Text style={styles.rankingPointsLabel}>pts</Text>
      </View>
    </View>
  );
}

// ─── Placeholders ────────────────────────────────────────────────────────────

function PremiumPlaceholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.premiumBadge}>
        <Text style={styles.premiumBadgeText}>PREMIUM</Text>
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderBody}>
        Full stats surface unlocks once the KPI field list is finalised (PRD register #12) and
        subscription flow lands (Phase 6).
      </Text>
    </View>
  );
}

function ComingSoonPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderBody}>{body}</Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  const dayStr = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dayStr} · ${timeStr}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { paddingBottom: 60 },

  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 6 },
  teamShort: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: Colors.light.textSecondary },
  teamName: { fontSize: 14, fontWeight: '600', color: Colors.light.text, textAlign: 'center' },
  scoreCol: { alignItems: 'center', gap: Spacing.two, minWidth: 96 },
  score: { fontSize: 32, fontWeight: '800', color: Colors.light.text, letterSpacing: -1 },
  vsMuted: { fontSize: 22, fontWeight: '600', color: Colors.light.textSecondary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  headerLine: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center' },

  subTabBarWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  subTabBarInner: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  subTabPress: { paddingVertical: 6 },
  subTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
  },
  subTabLabelActive: { color: Colors.light.text },
  subTabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: Colors.light.text,
    borderRadius: 2,
  },

  pane: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  paneEmpty: { paddingVertical: Spacing.four, alignItems: 'center' },
  paneEmptyText: { color: Colors.light.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 },

  statsGrid: { gap: 0 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  statValue: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.light.text, textAlign: 'left' },
  statValueRight: { textAlign: 'right' },
  statLabel: {
    flex: 2,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  lineupContainer: { gap: Spacing.four },
  lineupTeamBlock: { gap: 4 },
  lineupTeamHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  lineupTeamName: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  lineupSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    paddingTop: Spacing.two,
    paddingBottom: 2,
  },
  lineupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 4,
  },
  lineupNumber: {
    width: 26,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  lineupPos: { fontSize: 12, color: Colors.light.textSecondary, textTransform: 'capitalize' },

  rankingsPane: { gap: Spacing.three },
  rankingsMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 12,
  },
  rankingLead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  rankingName: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  rankingSub: { fontSize: 11, color: Colors.light.textSecondary },
  rankingTrail: { alignItems: 'flex-end' },
  rankingPoints: { fontSize: 22, fontWeight: '800', color: Colors.light.text },
  rankingPointsLabel: { fontSize: 10, color: Colors.light.textSecondary, letterSpacing: 1 },

  placeholder: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  premiumBadge: {
    borderWidth: 1,
    borderColor: '#B45309',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  premiumBadgeText: { color: '#B45309', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, textAlign: 'center' },
  placeholderBody: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
});
