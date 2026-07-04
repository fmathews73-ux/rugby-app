import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Coach, CoachRole, Fixture, LineUp, MatchEvent, MatchOfficial, MatchOfficialRole, Player, Result, Team } from '@rugby-app/shared';

import {
  useCompetitions,
  useFixture,
  useFixtureEvents,
  useFixtureLineups,
  useFixtureOfficials,
  useFixturePlayers,
  useFixtureResult,
  useTeamCoachingStaff,
  useTeams,
} from '@/api/hooks';
import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { PitchHeatmap } from '@/components/insights/pitch-heatmap';
import { ScoringProgression } from '@/components/insights/scoring-progression';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { LivePulseDot } from '@/components/live-pulse-dot';
import { MatchAnalysisCard } from '@/components/match-analysis-card';
import { PageGradient } from '@/components/page-gradient';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { useSimLive } from '@/dev/sim-live';
import { SimLiveToggle } from '@/dev/sim-live-toggle';
import { Colors, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Fixture detail. Header shows the matchup (flag balls + team names + score
 * if completed). A horizontal sub-tab strip switches between the 5 panes
 * defined in PRD §4.3 — Overview, Line-Up, Stats, Rankings, News. Stats and
 * News are placeholders (register #12 KPI list and register #8 news source
 * are still open).
 */

type SubTab = 'preview' | 'overview' | 'lineup' | 'stats' | 'insights' | 'analysis';

const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  // Temporal flow, synthesis at the end. Preview leads with pre-match
  // context (form, ranking trajectory, season baselines) — the backdrop
  // the match plays out against. Line-Up follows with the cast on the
  // day. Timeline is the running event log ("what happens / happened").
  // Stats is the numeric record; Insights the visual analytical read.
  // Analysis closes — the AI narrative synthesis that pulls everything
  // before it together into a written story. Reader flows left-to-right
  // through: expectation → cast → events → data → visual → narrative.
  { id: 'preview', label: 'Preview' },
  { id: 'lineup', label: 'Line-Up' },
  { id: 'overview', label: 'Timeline' },
  { id: 'stats', label: 'Stats' },
  { id: 'insights', label: 'Insights' },
  { id: 'analysis', label: 'Analysis' },
];

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
              {tab === 'insights' && (
                <InsightsPane
                  fixtureId={fixture.data.id}
                  homeTeamId={fixture.data.home_team_id}
                  awayTeamId={fixture.data.away_team_id}
                  fixtureStatus={fixture.data.status}
                />
              )}
              {tab === 'analysis' && (
                <AnalysisPane fixture={fixture.data} />
              )}
              {/* Dev-only synthetic-live toggle — visible only in __DEV__
                  and only for completed fixtures. Rewinds the match to
                  minute 0 and plays it out at ~8× speed so the polling
                  cadence + chart updates can be smoke-tested visually. */}
              <SimLiveToggle fixture={fixture.data} />
            </View>
          </ScrollView>
        </>
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
  const isLive = fixture.status === 'live' || fixture.status === 'half-time';
  const sim = useSimLive();

  // Match minute for the LIVE chip: sim mode sources from the sim's
  // virtual clock (kickoff is in the past — real elapsed would be huge).
  // Real live mode: elapsed real minutes since kickoff, clamped 0–80.
  const liveMinute = (() => {
    if (sim.active && sim.fixtureId === fixture.id) {
      return Math.floor(sim.virtualMinute);
    }
    const elapsed = Math.floor((Date.now() - new Date(fixture.kickoff_utc).getTime()) / 60000);
    return Math.min(80, Math.max(0, elapsed));
  })();

  return (
    <View style={styles.header}>
      {/* Date sits at the top as the temporal orient-me anchor.
          Competition + venue drop to below the flags/score row so the
          hero mirrors the Fixtures list layout: matchup first, then
          the "what tournament / where" meta line beneath. */}
      <Text style={styles.headerLine}>{formatKickoff(fixture.kickoff_utc)}</Text>
      {/* Row 1 — flags + score. Flags locked to `FlagSize.medium` (40 pt)
          to match the Home page fixture-carousel hero card — same "who's
          playing" visual weight across the two surfaces. The 3-letter
          team code sits inline next to each flag (home code on the RIGHT
          of the home flag, away code on the LEFT of the away flag) so the
          codes hug the score slot in the middle. */}
      <View style={styles.matchupTopRow}>
        <View style={styles.flagSlotHome}>
          {homeTeam ? (
            <TeamFlagBall2D flagCode={homeTeam.flag_code} size={FlagSize.medium} />
          ) : null}
          <Text style={styles.teamShort}>
            {homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}
          </Text>
        </View>
        <View style={styles.scoreSlot}>
          {(isCompleted || (isLive && result)) && result ? (
            // Any fixture with a result — completed OR live — shows the
            // score cluster. Middle annotation flips: 'FT' when completed,
            // pulsing dot + current minute when live. Winner accent only
            // applies once the match is final.
            <View style={styles.detailScoreRow}>
              <View
                style={[
                  styles.detailScoreBox,
                  isCompleted && result.home_score > result.away_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    isCompleted && result.home_score > result.away_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.home_score}
                </Text>
              </View>
              {isLive ? (
                <View style={styles.liveMiddle}>
                  <LivePulseDot size={5} />
                  <Text style={styles.liveMinute}>
                    {fixture.status === 'half-time' ? 'HT' : `${liveMinute}'`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.ftLabel}>FT</Text>
              )}
              <View
                style={[
                  styles.detailScoreBox,
                  isCompleted && result.away_score > result.home_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    isCompleted && result.away_score > result.home_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.away_score}
                </Text>
              </View>
            </View>
          ) : (
            // No result yet (scheduled / postponed / cancelled): status
            // pill anchors the match state where the score would go.
            <StatusPill status={fixture.status} />
          )}
        </View>
        <View style={styles.flagSlotAway}>
          <Text style={styles.teamShort}>
            {awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}
          </Text>
          {awayTeam ? (
            <TeamFlagBall2D flagCode={awayTeam.flag_code} size={FlagSize.medium} />
          ) : null}
        </View>
      </View>
      {/* Meta line below the flags/score row — competition · round · venue
          on a single centred line, mirroring the Fixtures list row's
          "COMP · Venue" meta placement. */}
      <Text style={styles.headerLine}>
        {competitionName ?? fixture.competition_id}
        {fixture.round ? ` · ${fixture.round}` : ''}
        {' · '}
        {fixture.venue}
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
  const showPulse = status === 'live' || status === 'half-time';
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {showPulse ? (
        <View style={styles.pillDotSlot}>
          <LivePulseDot size={6} color={Colors.light.background} />
        </View>
      ) : null}
      <Text style={[styles.pillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────

function SubTabBar({ tab, onSelect }: { tab: SubTab; onSelect: (t: SubTab) => void }) {
  // Pill-style tabs matching the CompetitionPicker treatment at the top of
  // the Fixtures + Standings tabs. Active pill: solid dark fill + white
  // label. Inactive pills: transparent fill with a light hairline border.
  // Same visual grammar across the app for "chip / segmented selector".
  return (
    <View style={styles.subTabBarWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subTabBarInner}>
        {SUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              style={[styles.subTabPill, active ? styles.subTabPillActive : styles.subTabPillInactive]}>
              <Text
                style={[styles.subTabPillLabel, active ? styles.subTabPillLabelActive : styles.subTabPillLabelInactive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Overview pane — match-event timeline ────────────────────────────────────

/**
 * Chronological timeline of match events. Home team on the left, away on
 * the right, milestone bars (kick-off / half-time / etc.) full-width.
 * Default view is expanded; "Show Less" collapses to milestones + scoring
 * events only, hiding cards + substitutions for a match-summary read.
 */
function OverviewPane({
  fixture,
  homeTeam,
  awayTeam,
  playerById,
}: {
  fixture: Fixture;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  playerById: Map<string, Player>;
}) {
  const events = useFixtureEvents(fixture.id, fixture.status);
  const [collapsed, setCollapsed] = useState(false);

  if (fixture.status === 'scheduled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Match hasn’t kicked off yet. The event timeline populates as the game unfolds.
        </Text>
      </View>
    );
  }
  if (events.isLoading) return <LoadingState />;
  if (events.isError) return <ErrorState error={events.error} />;
  const all = events.data ?? [];
  if (all.length === 0) {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>No events recorded for this fixture.</Text>
      </View>
    );
  }

  // Reverse-chronological order — most recent event at the top, kick-off at
  // the bottom. Matches the FIFA / ESPN convention for match timelines.
  const ordered = [...all].reverse();
  const visible = collapsed
    ? ordered.filter(
        (e) =>
          e.type === 'kick-off' ||
          e.type === 'half-time' ||
          e.type === 'second-half-start' ||
          e.type === 'full-time' ||
          e.type === 'try' ||
          e.type === 'penalty-goal' ||
          e.type === 'drop-goal',
      )
    : ordered;

  return (
    <View style={styles.timelineContainer}>
      {visible.map((ev) => (
        <TimelineRow
          key={ev.id}
          event={ev}
          fixture={fixture}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          playerById={playerById}
        />
      ))}
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={({ pressed }) => [styles.timelineToggle, pressed && { opacity: 0.6 }]}>
        <Text style={styles.timelineToggleText}>
          {collapsed ? 'Show more' : 'Show less'}
        </Text>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={Colors.light.text}
        />
      </Pressable>
    </View>
  );
}

/** One row in the timeline — dispatches to a milestone bar or a team-side
 *  event row based on the event type. */
function TimelineRow({
  event,
  fixture,
  homeTeam,
  awayTeam,
  playerById,
}: {
  event: MatchEvent;
  fixture: Fixture;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  playerById: Map<string, Player>;
}) {
  const isMilestone =
    event.type === 'kick-off' ||
    event.type === 'half-time' ||
    event.type === 'second-half-start' ||
    event.type === 'full-time';
  if (isMilestone) return <MilestoneBar type={event.type} />;
  const isHome = event.team_id === fixture.home_team_id;
  return (
    <EventRow
      event={event}
      isHome={isHome}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      playerById={playerById}
    />
  );
}

function MilestoneBar({ type }: { type: MatchEvent['type'] }) {
  const labels: Partial<Record<MatchEvent['type'], string>> = {
    'kick-off': 'Match Start',
    'half-time': 'Half Time',
    'second-half-start': 'Start Second Half',
    'full-time': 'Full Time',
  };
  return (
    <View style={styles.milestoneRow}>
      <Ionicons name="stopwatch-outline" size={14} color={Colors.light.textSecondary} />
      <Text style={styles.categoryLabel}>{labels[type] ?? type}</Text>
    </View>
  );
}

function EventRow({
  event,
  isHome,
  homeTeam,
  awayTeam,
  playerById,
}: {
  event: MatchEvent;
  isHome: boolean;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  playerById: Map<string, Player>;
}) {
  const team = isHome ? homeTeam : awayTeam;
  const label = describeEvent(event, team, playerById);
  const minuteLabel = event.stoppage
    ? `${event.minute}'+${event.stoppage}'`
    : `${event.minute}'`;
  return (
    <View style={styles.eventRow}>
      {isHome ? (
        <>
          <View style={styles.eventSideLeft}>
            <EventLabel event={event} label={label} align="right" playerById={playerById} />
            <EventIcon event={event} />
          </View>
          <Text style={styles.eventMinute}>{minuteLabel}</Text>
          <View style={styles.eventSideRight} />
        </>
      ) : (
        <>
          <View style={styles.eventSideLeft} />
          <Text style={styles.eventMinute}>{minuteLabel}</Text>
          <View style={styles.eventSideRight}>
            <EventIcon event={event} />
            <EventLabel event={event} label={label} align="left" playerById={playerById} />
          </View>
        </>
      )}
    </View>
  );
}

/** Small icon carrier for each event type. Cards are coloured Views (no
 *  icon exists that reads "yellow card" cleanly at this scale); everything
 *  else uses an Ionicon glyph. */
function EventIcon({ event }: { event: MatchEvent }) {
  switch (event.type) {
    case 'try':
      return <Ionicons name="american-football" size={16} color={Colors.light.text} />;
    case 'conversion':
    case 'penalty-goal':
    case 'drop-goal':
      return <Ionicons name="american-football-outline" size={14} color={Colors.light.textSecondary} />;
    case 'yellow-card':
      return <View style={[styles.cardGlyph, { backgroundColor: StatusColor.warning }]} />;
    case 'red-card':
      return <View style={[styles.cardGlyph, { backgroundColor: StatusColor.live }]} />;
    case 'substitution':
      // Two arrows stacked — up for player coming ON (green),
      // down for player going OFF (red).
      return (
        <View style={styles.subGlyph}>
          <Ionicons name="arrow-up" size={12} color="#059669" />
          <Ionicons name="arrow-down" size={12} color={StatusColor.live} />
        </View>
      );
    default:
      return null;
  }
}

function EventLabel({
  event,
  label,
  align,
  playerById,
}: {
  event: MatchEvent;
  label: string;
  align: 'left' | 'right';
  playerById: Map<string, Player>;
}) {
  if (event.type === 'substitution') {
    // Substitutions render as two stacked lines — the FIFA pattern. Green
    // arrow-in for the player coming ON, red arrow-out for the player OFF.
    const offName = playerById.get(event.player_id ?? '')?.name ?? '';
    const onName = playerById.get(event.related_player_id ?? '')?.name ?? '';
    return (
      <View style={[styles.subLabelWrap, align === 'right' ? styles.subLabelWrapRight : null]}>
        <Text style={styles.subLabelLine} numberOfLines={1}>{onName}</Text>
        <Text style={styles.subLabelLine} numberOfLines={1}>{offName}</Text>
      </View>
    );
  }
  return (
    <Text
      style={[styles.eventLabel, align === 'right' ? styles.eventLabelRight : null]}
      numberOfLines={1}>
      {label}
    </Text>
  );
}

/** Compose the display text for a non-substitution event. Player name +
 *  event type when the player lookup resolves; falls back to just the
 *  event type ("Try", "Penalty goal") when it doesn't. */
function describeEvent(
  event: MatchEvent,
  _team: Team | undefined,
  playerById: Map<string, Player>,
): string {
  const typeLabel: Partial<Record<MatchEvent['type'], string>> = {
    try: 'Try',
    conversion: 'Conversion',
    'penalty-goal': 'Penalty goal',
    'drop-goal': 'Drop goal',
    'yellow-card': 'Yellow card',
    'red-card': 'Red card',
  };
  const label = typeLabel[event.type] ?? event.type;
  const playerName = event.player_id ? playerById.get(event.player_id)?.name : null;
  return playerName ? `${playerName} · ${label}` : label;
}

function StatsPane({
  fixture,
  result,
  resultLoading,
}: {
  fixture: Fixture;
  result: Result | null;
  resultLoading: boolean;
}) {
  // Track which category's info modal is open; null when nothing is open.
  const [openInfoTitle, setOpenInfoTitle] = useState<string | null>(null);
  const events = useFixtureEvents(fixture.id, fixture.status);
  if (fixture.status === 'scheduled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Match hasn’t kicked off yet. Stats populate live once the game starts.
        </Text>
      </View>
    );
  }
  if (fixture.status === 'postponed' || fixture.status === 'cancelled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>Match {fixture.status} — no stats to show.</Text>
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

  // Rugby doesn't have formal quarters, but analysts widely use 20-minute
  // blocks (Q1 0–19, Q2 20–39, Q3 40–59, Q4 60+) to spot game-management
  // patterns. Derived from match-event minutes so no schema change to
  // `Result` is needed. Overtime + stoppage bucket into Q4.
  const quarterScores = computeQuarterScores(events.data ?? [], fixture);
  const sections: {
    title: string;
    description: string;
    stats: { label: string; home: number; away: number; premium: boolean }[];
  }[] = [
    {
      title: 'Match Overview',
      description:
        'The big-picture read on the match: how much of the ball each side had, how much of the game was played in the opponent\'s half, and where the score sat at half-time. A team can dominate possession + territory and still lose — this section is where those tensions show first.',
      stats: [
        { label: 'Possession %', home: result.home_possession_percent, away: result.away_possession_percent, premium: false },
        { label: 'Territory %', home: result.home_territory_percent, away: result.away_territory_percent, premium: false },
        { label: 'Half-time', home: result.half_time_home, away: result.half_time_away, premium: false },
      ],
    },
    {
      title: 'Scoring',
      description:
        'Breakdown of how each team\'s points were scored. Try = 5, conversion = 2, penalty goal = 3, drop goal = 3. A team leaning on penalties usually means they held territory but couldn\'t break the defensive line; a team with lots of unconverted tries left points behind.',
      stats: [
        { label: 'Tries', home: result.home_tries, away: result.away_tries, premium: false },
        { label: 'Conversions', home: result.home_conversions, away: result.away_conversions, premium: false },
        { label: 'Penalties', home: result.home_penalties, away: result.away_penalties, premium: true },
        { label: 'Drop goals', home: result.home_drop_goals, away: result.away_drop_goals, premium: true },
      ],
    },
    {
      title: 'Scoring by Quarter',
      description:
        'Points scored in each 20-minute block (Q1 = 0–20, Q2 = 20–40, Q3 = 40–60, Q4 = 60+). Rugby has no formal quarters, but analysts use these blocks to spot game-management patterns — teams that come out fast in Q1, teams that dominate after the half-time reset, teams that hold their nerve in the closing 20.',
      stats: [
        { label: 'Q1 (0–20 min)', home: quarterScores.home[0]!, away: quarterScores.away[0]!, premium: false },
        { label: 'Q2 (20–40 min)', home: quarterScores.home[1]!, away: quarterScores.away[1]!, premium: false },
        { label: 'Q3 (40–60 min)', home: quarterScores.home[2]!, away: quarterScores.away[2]!, premium: false },
        { label: 'Q4 (60+ min)', home: quarterScores.home[3]!, away: quarterScores.away[3]!, premium: false },
      ],
    },
    {
      title: 'Attack',
      description:
        'The "how did they move forward" numbers. Metres = total ground gained ball-in-hand. Line breaks = clean breaches of the defensive line. Carries = ball-carry actions. Passes = successful passes made. Offloads = ball passed in the tackle. A high metres-per-carry ratio is a sign of a dominant carrying pack; lots of offloads points to a team happy to keep the ball alive.',
      stats: [
        { label: 'Meters made', home: result.home_meters, away: result.away_meters, premium: true },
        { label: 'Line breaks', home: result.home_line_breaks, away: result.away_line_breaks, premium: true },
        { label: 'Carries', home: result.home_carries, away: result.away_carries, premium: true },
        { label: 'Passes', home: result.home_passes, away: result.away_passes, premium: true },
        { label: 'Offloads', home: result.home_offloads, away: result.away_offloads, premium: true },
      ],
    },
    {
      title: 'Kicking',
      description:
        'The kicking game — the "field-position lever" of rugby. Kicks in play = kicks that stayed on the field (chases, contestable box kicks, cross-field kicks). Kicks to touch = ball put out of bounds for a lineout. Kick metres gained = total ground won from kicks. Big kicking numbers usually mean a team playing a territorial game rather than running everything.',
      stats: [
        { label: 'Kicks in play', home: result.home_kicks_in_play, away: result.away_kicks_in_play, premium: true },
        { label: 'Kicks to touch', home: result.home_kicks_to_touch, away: result.away_kicks_to_touch, premium: true },
        { label: 'Kick metres gained', home: result.home_kick_meters, away: result.away_kick_meters, premium: true },
      ],
    },
    {
      title: 'Set Piece',
      description:
        'How each team fared at the set-piece phases — scrums and lineouts. Winning your own scrum or lineout is expected; losing it is a turnover in prime attacking territory. Winning the OPPONENT\'S is worth its weight in gold — steals disrupt phase play and momentum.',
      stats: [
        { label: 'Scrums won', home: result.home_scrums_won, away: result.away_scrums_won, premium: true },
        { label: 'Scrums lost', home: result.home_scrums_lost, away: result.away_scrums_lost, premium: true },
        { label: 'Lineouts won', home: result.home_lineouts_won, away: result.away_lineouts_won, premium: true },
        { label: 'Lineouts lost', home: result.home_lineouts_lost, away: result.away_lineouts_lost, premium: true },
      ],
    },
    {
      title: 'Defence',
      description:
        'The defensive read. Tackles made = total completed tackles. Tackle success % = the share of attempted tackles that stuck (85% is a solid Tier-1 baseline; below 80% usually means a leaky defensive shape). Turnovers won = ball reclaimed at the breakdown or via steals. Turnovers conceded = ball lost in contact — the flip side of the same coin.',
      stats: [
        { label: 'Tackles made', home: result.home_tackles_made, away: result.away_tackles_made, premium: true },
        { label: 'Tackle success %', home: result.home_tackle_success_percent, away: result.away_tackle_success_percent, premium: true },
        { label: 'Turnovers won', home: result.home_turnovers_won, away: result.away_turnovers_won, premium: true },
        { label: 'Turnovers conceded', home: result.home_turnovers_conceded, away: result.away_turnovers_conceded, premium: true },
      ],
    },
    {
      title: 'Discipline',
      description:
        'How well each team stayed inside the laws. Penalties conceded = referee whistles against. Handling errors = knock-ons and forward passes. Yellow cards = 10-minute sin-bin. Red cards = permanent dismissal. A well-drilled team tends to sit below 8 penalties a game; anything over 12 hands the opponent easy territory and shots at goal.',
      stats: [
        { label: 'Penalties conceded', home: result.home_penalties_conceded, away: result.away_penalties_conceded, premium: true },
        { label: 'Handling errors', home: result.home_handling_errors, away: result.away_handling_errors, premium: true },
        { label: 'Yellow cards', home: result.home_yellow_cards, away: result.away_yellow_cards, premium: true },
        { label: 'Red cards', home: result.home_red_cards, away: result.away_red_cards, premium: true },
      ],
    },
  ];

  const activeSection = sections.find((s) => s.title === openInfoTitle) ?? null;

  return (
    <View style={styles.statsPaneStack}>
      {sections.map((section) => (
        <View key={section.title} style={styles.statsCard}>
          <View style={styles.categoryHeaderRow}>
            <Text style={styles.categoryLabel}>{section.title}</Text>
            <Pressable
              onPress={() => setOpenInfoTitle(section.title)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Explain ${section.title}`}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={Colors.light.textSecondary}
              />
            </Pressable>
          </View>
          {section.stats.map((s) => (
            <StatBar
              key={s.label}
              label={s.label}
              home={s.home}
              away={s.away}
              locked={s.premium && !IS_SUBSCRIBED}
            />
          ))}
        </View>
      ))}
      <CategoryInfoModal
        title={activeSection?.title ?? ''}
        description={activeSection?.description ?? ''}
        visible={activeSection !== null}
        onClose={() => setOpenInfoTitle(null)}
      />
    </View>
  );
}

function CategoryInfoModal({
  title,
  description,
  visible,
  onClose,
}: {
  title: string;
  description: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.categoryModalBackdrop} onPress={onClose}>
        <Pressable style={styles.categoryModalCard} onPress={() => {}}>
          <View style={styles.categoryModalHeader}>
            <Text style={styles.categoryModalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.categoryModalBody}>{description}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Stat-bar colour tokens — same solid pair the Efficiency KPI card uses so
// the two adjacent surfaces read as one visual system. Leader green =
// GOOD_COLOR from that card; lagger red = BAD_COLOR (StatusColor.live);
// tie renders in secondary text grey.
const LEADING_COLOR = '#059669';
const LAGGING_COLOR = StatusColor.live;
const TIE_COLOR = Colors.light.textSecondary;

/**
 * Sum scoring events into 20-minute quarters, per team. Rugby has no formal
 * quarters, but coaches / analysts widely use 20-min blocks to identify
 * game-management patterns ("we always lose Q3"). Overtime and stoppage
 * (minute >= 80) bucket into Q4 so the total across quarters still equals
 * the final score.
 */
function computeQuarterScores(
  events: readonly MatchEvent[],
  fixture: Fixture,
): { home: [number, number, number, number]; away: [number, number, number, number] } {
  const out = {
    home: [0, 0, 0, 0] as [number, number, number, number],
    away: [0, 0, 0, 0] as [number, number, number, number],
  };
  for (const e of events) {
    if (!e.team_id || e.points <= 0) continue;
    const min = e.minute + (e.stoppage ?? 0);
    const q = min < 20 ? 0 : min < 40 ? 1 : min < 60 ? 2 : 3;
    if (e.team_id === fixture.home_team_id) out.home[q] += e.points;
    else if (e.team_id === fixture.away_team_id) out.away[q] += e.points;
  }
  return out;
}

/** DEMO: hard-coded subscription flag. Temporarily set `true` so every stat
 * renders unblurred while we're iterating on Stats-tab styling — re-flip to
 * `false` when we come back to demo the free-vs-paid overlay. Real auth /
 * entitlement check lands at Phase 6 when the paywall + billing flow ships. */
const IS_SUBSCRIBED = true;

function StatBar({
  label,
  home,
  away,
  locked = false,
}: {
  label: string;
  home: number;
  away: number;
  locked?: boolean;
}) {
  const maxValue = Math.max(home, away, 1);
  const homeShare = home / maxValue;
  const awayShare = away / maxValue;

  // 0 → 1 progress ramps the fill in on mount and re-plays whenever the
  // underlying values change (e.g. a live-updating result). Interpolators
  // below map progress onto the flex values so each half grows out from
  // the centre gap towards its flag. useNativeDriver is `false` because
  // we're animating a layout prop (flex) — the animation still runs
  // smoothly for the ~30 bars on the Stats tab.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [home, away, progress]);

  const homeSegFlex = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.001, Math.max(0.001, homeShare)],
  });
  const homeSpacerFlex = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, Math.max(0.001, 1 - homeShare)],
  });
  const awaySegFlex = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.001, Math.max(0.001, awayShare)],
  });
  const awaySpacerFlex = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, Math.max(0.001, 1 - awayShare)],
  });

  // Leading / lagging colouring: the higher value wins the green bar, the
  // lower gets the red. Ties render both bars in the neutral secondary text
  // colour so "no leader" reads distinctly. Uses the app's existing win /
  // loss tokens for consistency with the form sparkline + momentum arrows.
  const homeColor =
    home > away ? LEADING_COLOR : home < away ? LAGGING_COLOR : TIE_COLOR;
  const awayColor =
    away > home ? LEADING_COLOR : away < home ? LAGGING_COLOR : TIE_COLOR;

  return (
    <View style={styles.statBlock}>
      {/* Label stays crisp so locked users can still see the metric name. */}
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarRowWrap}>
        <View style={styles.statBarRow}>
          <Text style={styles.statValueLeft}>{home}</Text>
          <View style={styles.barTrack}>
            <View style={styles.barHalfLeft}>
              <Animated.View
                style={[styles.barSegHome, { flex: homeSegFlex, backgroundColor: homeColor }]}
              />
              <Animated.View style={{ flex: homeSpacerFlex }} />
            </View>
            <View style={styles.barCentreGap} />
            <View style={styles.barHalfRight}>
              <Animated.View
                style={[styles.barSegAway, { flex: awaySegFlex, backgroundColor: awayColor }]}
              />
              <Animated.View style={{ flex: awaySpacerFlex }} />
            </View>
          </View>
          <Text style={styles.statValueRight}>{away}</Text>
        </View>
        {locked ? (
          <BlurView
            intensity={30}
            tint="light"
            style={styles.statBlurOverlay}
          />
        ) : null}
      </View>
    </View>
  );
}

// ─── Line-Up pane ────────────────────────────────────────────────────────────

function LineUpPane({
  fixture,
  lineups,
  lineupsLoading,
  playerById,
}: {
  fixture: Fixture;
  lineups: LineUp[];
  lineupsLoading: boolean;
  playerById: Map<string, Player>;
}) {
  const homeCoaches = useTeamCoachingStaff(fixture.home_team_id);
  const awayCoaches = useTeamCoachingStaff(fixture.away_team_id);
  const officials = useFixtureOfficials(fixture.id);
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
  const homeLineup = lineups.find((lu) => lu.team_id === fixture.home_team_id);
  const awayLineup = lineups.find((lu) => lu.team_id === fixture.away_team_id);

  // Pair up entries index-by-index. Starting XV numbers 1-15 are canonical
  // positions shared across both teams; bench 16-23 loosely mirror as
  // well. Iterating by the longer of the two lists means either team can
  // have a missing entry without breaking the row structure.
  const startingRows = pairEntries(
    homeLineup?.starting_xv ?? [],
    awayLineup?.starting_xv ?? [],
  );
  const benchRows = pairEntries(homeLineup?.bench ?? [], awayLineup?.bench ?? []);

  return (
    <View style={styles.lineupContainer}>
      {/* Section pills carry an inline people-icon inside — same treatment
          as the Overview timeline's MilestoneBar so the two panes share
          one section-header pattern across the app. */}
      <View style={styles.lineupSectionHeader}>
        <Ionicons name="american-football-outline" size={14} color={Colors.light.textSecondary} />
        <Text style={styles.categoryLabel}>Starting XV</Text>
      </View>
      {startingRows.map(({ home, away }, i) => (
        <LineUpCompareRow key={`start-${i}`} home={home} away={away} playerById={playerById} />
      ))}

      <View style={styles.lineupSectionHeader}>
        <Ionicons name="american-football-outline" size={14} color={Colors.light.textSecondary} />
        <Text style={styles.categoryLabel}>Bench</Text>
      </View>
      {benchRows.map(({ home, away }, i) => (
        <LineUpCompareRow key={`bench-${i}`} home={home} away={away} playerById={playerById} />
      ))}

      {/* Coaching staff — hidden entirely if the feed returns nothing (real
          feeds may not carry it — PRD register #7). Synthetic dev data
          gives every team 4 roles: head, attack, defence, forwards. */}
      {(homeCoaches.data?.length ?? 0) + (awayCoaches.data?.length ?? 0) > 0 ? (
        <>
          <View style={styles.lineupSectionHeader}>
            <Ionicons name="people-outline" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.categoryLabel}>Coaching Staff</Text>
          </View>
          {pairCoachesByRole(homeCoaches.data ?? [], awayCoaches.data ?? []).map(
            ({ role, home, away }) => (
              <CoachingCompareRow key={role} role={role} home={home} away={away} />
            ),
          )}
        </>
      ) : null}

      {/* Match officials — announced pre-match, so this section renders for
          scheduled fixtures too. Hidden if the feed returns nothing. */}
      {(officials.data?.length ?? 0) > 0 ? (
        <>
          <View style={styles.lineupSectionHeader}>
            <Ionicons name="people-outline" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.categoryLabel}>Match Officials</Text>
          </View>
          {sortOfficialsByRole(officials.data ?? []).map((o) => (
            <OfficialRow key={o.id} official={o} />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** Roles rendered in order — head coach first, then attack / defence /
 *  forwards. If a team is missing a role, we still show the row (empty
 *  name on that side) so home/away stay index-aligned. */
const COACH_ROLE_ORDER: readonly CoachRole[] = [
  'head-coach',
  'attack-coach',
  'defence-coach',
  'forwards-coach',
  'skills-coach',
  'kicking-coach',
  'assistant-coach',
];

const COACH_ROLE_LABELS: Record<CoachRole, string> = {
  'head-coach': 'Head Coach',
  'attack-coach': 'Attack Coach',
  'defence-coach': 'Defence Coach',
  'forwards-coach': 'Forwards Coach',
  'skills-coach': 'Skills Coach',
  'kicking-coach': 'Kicking Coach',
  'assistant-coach': 'Assistant Coach',
};

function pairCoachesByRole(
  home: readonly Coach[],
  away: readonly Coach[],
): { role: CoachRole; home: Coach | null; away: Coach | null }[] {
  const homeByRole = new Map(home.map((c) => [c.role, c]));
  const awayByRole = new Map(away.map((c) => [c.role, c]));
  const roles = new Set<CoachRole>([...homeByRole.keys(), ...awayByRole.keys()]);
  return COACH_ROLE_ORDER
    .filter((r) => roles.has(r))
    .map((role) => ({ role, home: homeByRole.get(role) ?? null, away: awayByRole.get(role) ?? null }));
}

/** Match-official roles rendered top-to-bottom. Referee first (the on-field
 *  authority), then the two sideline officials, then the TMO — matches
 *  the standard broadcast intro. */
const OFFICIAL_ROLE_ORDER: readonly MatchOfficialRole[] = [
  'referee',
  'assistant-referee-1',
  'assistant-referee-2',
  'tmo',
];

const OFFICIAL_ROLE_LABELS: Record<MatchOfficialRole, string> = {
  'referee': 'Referee',
  'assistant-referee-1': 'Sideline',
  'assistant-referee-2': 'Sideline',
  'tmo': 'TMO',
};

function sortOfficialsByRole(officials: readonly MatchOfficial[]): MatchOfficial[] {
  return [...officials].sort(
    (a, b) => OFFICIAL_ROLE_ORDER.indexOf(a.role) - OFFICIAL_ROLE_ORDER.indexOf(b.role),
  );
}

/**
 * Single-line row: role on the left (tracked xs textSecondary), official's
 * name on the right (bold sm text). Officials are match-scoped (neutral),
 * so there's no home / away split like the coaching row.
 */
function OfficialRow({ official }: { official: MatchOfficial }) {
  return (
    <View style={styles.officialRow}>
      <Text style={styles.officialRole}>{OFFICIAL_ROLE_LABELS[official.role]}</Text>
      <Text style={styles.officialName} numberOfLines={1}>
        {official.name}
      </Text>
    </View>
  );
}

function CoachingCompareRow({
  role,
  home,
  away,
}: {
  role: CoachRole;
  home: Coach | null;
  away: Coach | null;
}) {
  return (
    <View style={styles.coachingRow}>
      <Text style={styles.coachingRole} numberOfLines={1}>
        {COACH_ROLE_LABELS[role]}
      </Text>
      <View style={styles.coachingNamesRow}>
        <Text style={styles.coachingName} numberOfLines={1}>
          {home?.name ?? '—'}
        </Text>
        <Text style={[styles.coachingName, styles.coachingNameRight]} numberOfLines={1}>
          {away?.name ?? '—'}
        </Text>
      </View>
    </View>
  );
}

type LineUpEntry = LineUp['starting_xv'][number];

/** Pair line-up entries index-by-index so both teams' same-shirt-number
 * players sit on the same row. Pads with `null` where either team has a
 * shorter list. */
function pairEntries(
  home: readonly LineUpEntry[],
  away: readonly LineUpEntry[],
): { home: LineUpEntry | null; away: LineUpEntry | null }[] {
  const max = Math.max(home.length, away.length);
  const out: { home: LineUpEntry | null; away: LineUpEntry | null }[] = [];
  for (let i = 0; i < max; i++) {
    out.push({ home: home[i] ?? null, away: away[i] ?? null });
  }
  return out;
}

/** Format a canonical Position id ('loose-head-prop') into a Title-Case
 * display label ('Loose Head Prop'). Matches the sub-tab label style
 * (Overview / Line-Up / Stats / …) — same typographic register. */
function formatPosition(pos: string): string {
  return pos
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function LineUpCompareRow({
  home,
  away,
  playerById,
}: {
  home: LineUpEntry | null;
  away: LineUpEntry | null;
  playerById: Map<string, Player>;
}) {
  // Each side renders `[shirt#] [player name]` on the home side and its
  // mirror `[player name] [shirt#]` on the away side. Falls back to the
  // canonical position label if the player lookup misses (shouldn't
  // happen when the API resolves properly).
  const homeLabel = home
    ? playerById.get(home.player_id)?.name ?? formatPosition(home.position)
    : '';
  const awayLabel = away
    ? playerById.get(away.player_id)?.name ?? formatPosition(away.position)
    : '';
  return (
    <View style={styles.lineupCompareRow}>
      <View style={styles.lineupSideLeft}>
        <View style={styles.lineupNumberBadge}>
          <Text style={styles.lineupNumberText}>{home?.shirt_number ?? '·'}</Text>
        </View>
        <Text style={styles.lineupPosPlayer} numberOfLines={1}>
          {homeLabel}
        </Text>
      </View>
      <View style={styles.lineupSideRight}>
        <Text style={[styles.lineupPosPlayer, styles.lineupPosPlayerRight]} numberOfLines={1}>
          {awayLabel}
        </Text>
        <View style={styles.lineupNumberBadge}>
          <Text style={styles.lineupNumberText}>{away?.shirt_number ?? '·'}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Preview pane ────────────────────────────────────────────────────────────

/**
 * Pre-match team context — recent form, WR ranking trajectory, and season
 * KPI averages for both sides. Rendered as the leftmost sub-tab so viewers
 * land on "who are we comparing" before the match itself. Each card uses a
 * two-side toggle pill to switch between home and away.
 */
function PreviewPane({
  homeTeamId,
  awayTeamId,
  asOfDate,
}: {
  homeTeamId: string;
  awayTeamId: string;
  /** Freezes every card on this pane to the state it would have shown
   *  the day of the fixture — Form / Trajectory / KPIs all drop data
   *  timestamped at or after this ISO string. Makes a fixture opened
   *  in 2027 still read as the *pre-match* view from 2025. */
  asOfDate: string;
}) {
  return (
    <View style={styles.insightsPaneStack}>
      {/* Form (last-10) leads — recent trend sets up the deeper season
          context (ranking trajectory + KPIs) below. Toggle pill switches
          home ↔ away. */}
      <ExtendedMomentum
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
      <RankingTrajectory
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
      <EfficiencyKpis
        teamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
      />
    </View>
  );
}

// ─── Insights pane ───────────────────────────────────────────────────────────

/**
 * Per-fixture Insights — sits next to the Stats sub-tab so users flipping
 * between the raw numbers and the analytics view during a live match don't
 * travel far. Scoped to this fixture's two teams (home + away), so there's
 * no team-picker chrome. Rendered inside the fixture-drill ScrollView, so
 * no SafeAreaView / ScrollView of its own.
 */
function InsightsPane({
  fixtureId,
  homeTeamId,
  awayTeamId,
  fixtureStatus,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  fixtureStatus: Fixture['status'];
}) {
  return (
    <View style={styles.insightsPaneStack}>
      <InsightsCanvas
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />
      {/* Momentum — mirrored area chart. Home team lifts above the zero
          baseline in light blue, away drops below in light purple.
          Rolling 10-minute scoring density per side across the 80'
          match canvas, with KO / HT / FT milestone verticals. Paired
          adjacent to Scoring Progression below so the reader can compare
          in-match INITIATIVE (this card) with in-match RESULT (below). */}
      <CombinedPointsPattern
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
      />
      {/* Scoring progression — broadcast-worm cumulative-points chart.
          Both team lines overlaid so the story (leads, comebacks, lead
          changes) reads directly from where the worms cross. Sits
          directly after Momentum since both are temporal match-flow
          cards on the same 0..80' axis. */}
      <ScoringProgression
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />
      {/* Pitch heatmap — density of the active team's positional events
          (carries + scoring) on a top-down pitch. Match-scoped. Closes
          the Insights pane as the spatial detail card — the "where"
          after the "who / when / result" story above. */}
      <PitchHeatmap
        fixtureId={fixtureId}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixtureStatus}
      />
    </View>
  );
}

// ─── Analysis pane ───────────────────────────────────────────────────────────

/**
 * AI-generated broadcast-style commentary on the fixture. Reads the same
 * data all other panes read (result totals, event timeline) via the
 * `useMatchAnalysis` hook. Renders inside the shared stack so vertical
 * chrome (padding, gap) matches the Insights and Stats panes.
 *
 * Scheduled fixtures render an empty-state message inside the card —
 * there's no history to analyse yet.
 */
function AnalysisPane({ fixture }: { fixture: Fixture }) {
  return (
    <View style={styles.insightsPaneStack}>
      <MatchAnalysisCard fixture={fixture} />
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  const dayStr = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dayStr} · ${timeStr}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 60 },

  header: {
    // Hero section stays white against the grey page background — reads as
    // a top strip that owns the flags + score, distinct from the tab body.
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    // Bottom padding mirrors the matchupTopRow marginTop above the flags
    // + score row, so the hero has symmetric breathing room on both
    // sides of the "who's playing" row.
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  matchupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    paddingHorizontal: Spacing.two,
    // Symmetric breathing room above AND below the flags/score cluster —
    // separates the "who's playing" hero from both the date/time meta
    // above and the competition/venue meta below by the same amount.
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  // Home + away flag-with-code columns. Each column is a flex-1 slot that
  // matches the width of the middle score slot's flex sibling, so codes
  // hug the score rather than the outer edges of the screen. Home
  // renders [flag][code] left-to-right; away mirrors as [code][flag].
  flagSlotHome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flagSlotAway: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  teamShort: { fontSize: TextSize.sm, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide, color: Colors.light.textSecondary },
  // scoreSlot is used twice: once wrapping the score row (top) and once as an
  // invisible spacer beneath it — same width both times so the labels sit
  // symmetric around the score column.
  scoreSlot: { minWidth: 124, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  // gap 8 between each score box and the FT label — a bit more breathing
  // room than the small-tile 6pt gap because the boxes and text are all
  // scaled up here.
  detailScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // Card-scale "FT" annotation: 12pt bold, wide tracking, textSecondary.
  // Mirrors the row-scale FT (10pt bold wide) at the card tier — both
  // muted to read as informational annotation, not decoration.
  ftLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Live-state middle chip in the hero: pulsing red dot + live minute
  // (or 'HT' during half-time break). Sits in the same middle position
  // as the 'FT' annotation for completed matches.
  liveMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveMinute: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: StatusColor.live,
    fontVariant: ['tabular-nums'],
  },
  detailScoreBox: {
    ...ScoreBoxSize.card,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScoreBoxWinner: { backgroundColor: Colors.light.text },
  detailScoreText: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  detailScoreTextWinner: { color: Colors.light.textInverse },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pillText: { fontSize: TextSize.xs, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
  pillDotSlot: { justifyContent: 'center' },
  headerLine: { fontSize: TextSize.sm, color: Colors.light.textSecondary, textAlign: 'center' },

  subTabBarWrap: {
    // White strip continues the hero card into the tab-bar row so the top of
    // the screen reads as one bonded surface; the grey page background
    // starts BELOW the sub-tabs.
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    // Matches the fixture-detail page inset used by the matchup header and
    // all pane content. Also mirrors the CompetitionPicker's behaviour on
    // Fixtures / Standings where pills clip at the outer wrap boundary
    // rather than the raw screen edge — buffered fade instead of a hard
    // cut against the phone bezel.
    paddingHorizontal: Spacing.four,
  },
  subTabBarInner: {
    paddingVertical: Spacing.two + 2,
    gap: Spacing.two,
  },
  // Pill treatment matching CompetitionPicker on the Fixtures + Standings
  // tabs — same shape language for "chip / segmented selector" across the
  // app. Dimensions / radius / colours mirror `competition-picker.tsx`.
  // Borderless — fill alone carries the active/inactive contrast, matching
  // the TeamToggle pill treatment elsewhere in the app.
  subTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subTabPillActive: {
    backgroundColor: Colors.light.text,
  },
  subTabPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  subTabPillLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: 0.4,
  },
  subTabPillLabelActive: { color: Colors.light.background },
  subTabPillLabelInactive: { color: Colors.light.textSecondary },

  pane: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  paneEmpty: { paddingVertical: Spacing.four, alignItems: 'center' },
  paneEmptyText: { color: Colors.light.textSecondary, fontSize: TextSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 320 },

  // ─── Overview timeline ────────────────────────────────────────────────────
  // Same white-card chrome as `statsCard` / `lineupContainer` so all three
  // panes render inside an identical container silhouette. Gap kept at 0
  // — the event rows already own their own vertical padding.
  timelineContainer: {
    gap: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 32,
  },
  // Left / right halves for each event row. Left half hosts home events,
  // right half hosts away events. Both are flex:1 so the central minute
  // label sits perfectly centred regardless of content width.
  eventSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  eventSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  eventMinute: {
    width: 48,
    textAlign: 'center',
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
    letterSpacing: TextTracking.wide,
  },
  eventLabel: {
    flexShrink: 1,
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  eventLabelRight: { textAlign: 'right' },
  cardGlyph: { width: 10, height: 14, borderRadius: 2 },
  subGlyph: { flexDirection: 'column', alignItems: 'center' },
  subLabelWrap: { gap: 2, flexShrink: 1 },
  subLabelWrapRight: { alignItems: 'flex-end' },
  subLabelLine: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },

  // Timeline milestone row — centred icon + uppercase label pair anchoring
  // the timeline at kick-off / half-time / etc. Same treatment as the
  // Line-Up section headers so the two panes share one visual pattern.
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
  },
  // Line-Up section header — icon + uppercase label centred. Same
  // treatment as milestoneRow so the two panes share one section-header
  // pattern.
  lineupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.two,
    paddingBottom: 2,
  },
  // Show More / Show Less toggle at the bottom of the timeline.
  timelineToggle: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timelineToggleText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
  },

  // Stats pane stacks one card per category. `statsPaneStack` gives the
  // outer vertical rhythm; each `statsCard` is a self-contained white
  // card with a small `categoryLabel` header (matching the Form / Momentum
  // / KPI card title convention) and the stat rows below.
  statsPaneStack: { gap: Spacing.three },
  categoryLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Header row of each Stats category card: the label sits at the top-left
  // with a small info icon immediately next to it. Same pattern as the
  // Form / Momentum / KPI card headers on the Preview and Insights panes.
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  categoryModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryModalTitle: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  categoryModalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statBlock: { gap: 6 },
  statLabel: {
    fontSize: TextSize.sm,
    // Muted — the label is context, the numbers on either side are the
    // read. Lets the values pop visually without shouting.
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontWeight: TextWeight.regular,
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Numeric readouts flanking each stat bar. Bold to match the numeric-hero
  // weight used across the app (score boxes, rankings tile). Home / away
  // colour split mirrors the bar-segment token pair per design-system §5.4:
  // home = primary text, away = secondary text.
  statValueLeft: {
    width: 32,
    textAlign: 'left',
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  statValueRight: {
    width: 32,
    textAlign: 'right',
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // Track matches the Efficiency KPI row: 4pt-tall grey slab, small
  // corner radius (not pill), tight breathing room from the flanking
  // values. Diverging halves are preserved so each side still grows out
  // from the centre — the shared thinness ties the two cards visually.
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  /** Both halves are equal flex so the CENTRE of the track is the meeting
   * point regardless of the values. Home segment anchors to the right edge
   * of the left half (i.e. adjacent to the centre); away anchors to the
   * left edge of the right half. `row-reverse` on the left half places the
   * home segment on the right — same visual effect. */
  barHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 4,
  },
  barHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  barCentreGap: { width: 2, height: 4 },
  // Segments own the small-radius shape + fixed height; each fills with a
  // solid backgroundColor set inline (LEADING / LAGGING / TIE) so the two
  // KPI-adjacent bars carry identical fill treatment.
  barSegHome: { borderRadius: 2, height: 4 },
  barSegAway: { borderRadius: 2, height: 4 },

  statBarRowWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  /** Blur overlay that sits on top of the value + bar row (but underneath the
   * label above it) when a metric is behind the premium gate. Values and
   * segments smear into a frosted band; the label stays crisp so the user
   * knows what they're missing. */
  statBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Matches the `statsCard` / `timelineContainer` white card so Line-Up,
  // Timeline and Stats panes share one container silhouette.
  lineupContainer: {
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Coaching-staff compare row — two-line stack. Row 1: role label centred.
  // Row 2: home name (left) / away name (right). Frees up full row-width
  // for each name so longer names read comfortably without truncation.
  coachingRow: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    // Line-space between the role label and the names underneath so each
    // pairing reads as a clear "role → coaches" block rather than a
    // stacked-tight two-liner.
    gap: Spacing.two,
  },
  coachingRole: {
    textAlign: 'center',
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  coachingNamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  coachingName: {
    flex: 1,
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  coachingNameRight: { textAlign: 'right' },

  // Official row — role (left, xs tracked textSecondary) + name (right,
  // sm bold text). One line per official; four rows total (referee, two
  // sideline, TMO). Officials are match-neutral so there's no home/away split.
  officialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    gap: Spacing.two,
  },
  officialRole: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  officialName: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },

  lineupSectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    paddingTop: Spacing.three,
    paddingBottom: 4,
    textAlign: 'center',
  },
  // Compare row: [home #] [home player-label]   [away player-label] [away #]
  // Numbers pinned to the outer edges; each team's player-label
  // (currently the position, will become the player name when the feed
  // supplies it) sits inboard of its shirt number, closer to the centre.
  lineupCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  lineupSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineupSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  // Shirt-number badge — small grey circle wrapping the tabular-nums
  // number. Same grey (#F3F4F6) used by the Stats bar tracks + KPI bar
  // tracks so all "muted-fill" surfaces in the fixture drill share one
  // token. Fixed 22 × 22 keeps a clean 11pt radius regardless of digit
  // count (single-digit numbers still centre inside a full circle).
  lineupNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineupNumberText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  lineupPosPlayer: {
    // Row text matches the Stats card label pattern: sm regular
    // textSecondary. Bold weight is reserved for the numeric read (shirt
    // number) so numbers pop and names sit as legible context around them.
    flexShrink: 1,
    fontSize: TextSize.sm,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
  },
  lineupPosPlayerRight: {
    textAlign: 'right',
  },

  // Insights pane — vertical stack of the same BI cards used on the
  // Insights tab, scoped to this fixture's two teams. Each card handles its
  // own horizontal margin, so the stack just needs vertical breathing room.
  insightsPaneStack: { gap: Spacing.three, paddingBottom: Spacing.four },
});
