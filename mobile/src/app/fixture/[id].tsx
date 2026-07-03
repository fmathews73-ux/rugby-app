import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Coach, CoachRole, Fixture, LineUp, MatchEvent, Player, Result, Team } from '@rugby-app/shared';

import {
  useCompetitions,
  useFixture,
  useFixtureEvents,
  useFixtureLineups,
  useFixturePlayers,
  useFixtureResult,
  useLatestRanking,
  useTeamCoachingStaff,
  useTeams,
} from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, ScoreBoxSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

/**
 * Fixture detail. Header shows the matchup (flag balls + team names + score
 * if completed). A horizontal sub-tab strip switches between the 5 panes
 * defined in PRD §4.3 — Overview, Line-Up, Stats, Rankings, News. Stats and
 * News are placeholders (register #12 KPI list and register #8 news source
 * are still open).
 */

type SubTab = 'overview' | 'lineup' | 'stats' | 'rankings' | 'news';

const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  // Line-Up first — represents "who is playing", the primary "team about to
  // play" data. Everything else (Overview scores, Stats, Rankings, News)
  // orbits around the players who take the field.
  { id: 'lineup', label: 'Line-Up' },
  { id: 'overview', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'news', label: 'News' },
];

export default function FixtureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<SubTab>('lineup');

  const fixture = useFixture(id ?? '');
  const result = useFixtureResult(id ?? '');
  const lineups = useFixtureLineups(id ?? '');
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
          <SubTabBar tab={tab} onSelect={setTab} />
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.pane}>
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
  return (
    <View style={styles.header}>
      {/* Header meta stack: date first (the "when"), competition + round
          second (the "what tournament"), venue third (the "where"). Puts
          the strongest temporal orient-me anchor at the very top. */}
      <Text style={styles.headerLine}>{formatKickoff(fixture.kickoff_utc)}</Text>
      <Text style={styles.headerMeta}>
        {competitionName ?? fixture.competition_id}
        {fixture.round ? ` · ${fixture.round}` : ''}
      </Text>
      <Text style={styles.headerLine}>{fixture.venue}</Text>
      {/* Row 1 — flags + score, every item locked at FlagSize.header (56 pt)
          so alignItems: 'center' collapses to identical vertical centres. */}
      <View style={styles.matchupTopRow}>
        <View style={styles.flagSlot}>
          {homeTeam ? (
            <TeamFlagBall2D flagCode={homeTeam.flag_code} size={FlagSize.header} />
          ) : null}
        </View>
        <View style={styles.scoreSlot}>
          {isCompleted && result ? (
            <View style={styles.detailScoreRow}>
              <View
                style={[
                  styles.detailScoreBox,
                  result.home_score > result.away_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    result.home_score > result.away_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.home_score}
                </Text>
              </View>
              <Text style={styles.ftLabel}>FT</Text>
              <View
                style={[
                  styles.detailScoreBox,
                  result.away_score > result.home_score && styles.detailScoreBoxWinner,
                ]}>
                <Text
                  style={[
                    styles.detailScoreText,
                    result.away_score > result.home_score && styles.detailScoreTextWinner,
                  ]}>
                  {result.away_score}
                </Text>
              </View>
            </View>
          ) : (
            // Non-completed: the status pill (Upcoming / LIVE / HT /
            // Postponed / Cancelled) sits in the score slot, replacing the
            // old muted "vs" text. Anchors the match state where the score
            // would eventually appear once the match completes.
            <StatusPill status={fixture.status} />
          )}
        </View>
        <View style={styles.flagSlot}>
          {awayTeam ? (
            <TeamFlagBall2D flagCode={awayTeam.flag_code} size={FlagSize.header} />
          ) : null}
        </View>
      </View>
      {/* Row 2 — team codes + names below. Empty middle slot preserves symmetry
          around the score, so home / away labels line up under their flag. */}
      <View style={styles.matchupLabelsRow}>
        <View style={styles.labelCol}>
          <Text style={styles.teamShort}>
            {homeTeam?.short_name ?? fixture.home_team_id.toUpperCase()}
          </Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {homeTeam?.name ?? fixture.home_team_id}
          </Text>
        </View>
        <View style={styles.scoreSlot} />
        <View style={styles.labelCol}>
          <Text style={styles.teamShort}>
            {awayTeam?.short_name ?? fixture.away_team_id.toUpperCase()}
          </Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {awayTeam?.name ?? fixture.away_team_id}
          </Text>
        </View>
      </View>
      {/* Status pill for non-completed matches lives in the score slot
          above; for completed matches, "Final" appears as the Overview
          card title. Nothing else to render here. */}
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
  const events = useFixtureEvents(fixture.id);
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
      <View style={styles.milestoneBar}>
        <Ionicons name="stopwatch-outline" size={14} color={Colors.light.textSecondary} />
        <Text style={styles.milestoneText}>{labels[type] ?? type}</Text>
      </View>
    </View>
  );
}

/**
 * Match-state bar for the top of the Stats pane. Same pill silhouette as
 * MilestoneBar so the shape stays constant across states; the fill /
 * colour / content flip per fixture status:
 *   - completed  → grey pill + stopwatch + "FULL TIME"
 *   - live       → red pill + red dot + white "LIVE {n}'"
 *   - half-time  → amber pill + stopwatch + white "HALF TIME"
 *   - scheduled  → not rendered (StatsPane returns an empty state instead)
 */
function StateBar({ fixture }: { fixture: Fixture }) {
  if (fixture.status === 'completed') return <MilestoneBar type="full-time" />;
  if (fixture.status === 'half-time') {
    return (
      <View style={styles.milestoneRow}>
        <View style={[styles.milestoneBar, styles.stateBarHalfTime]}>
          <Ionicons name="stopwatch-outline" size={14} color={Colors.light.textInverse} />
          <Text style={[styles.milestoneText, styles.stateBarInverseText]}>Half Time</Text>
        </View>
      </View>
    );
  }
  if (fixture.status === 'live') {
    const minute = Math.min(80, Math.max(0, Math.floor((Date.now() - new Date(fixture.kickoff_utc).getTime()) / 60000)));
    return (
      <View style={styles.milestoneRow}>
        <View style={[styles.milestoneBar, styles.stateBarLive]}>
          <View style={styles.stateBarLiveDot} />
          <Text style={[styles.milestoneText, styles.stateBarInverseText]}>Live · {minute}'</Text>
        </View>
      </View>
    );
  }
  return null;
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
  const events = useFixtureEvents(fixture.id);
  if (fixture.status === 'scheduled') {
    return (
      <View style={styles.paneEmpty}>
        <Text style={styles.paneEmptyText}>
          Match hasn’t kicked off yet. Stats will populate once the fixture is complete.
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
    stats: { label: string; home: number; away: number; premium: boolean }[];
  }[] = [
    {
      title: 'Match Overview',
      stats: [
        { label: 'Possession %', home: result.home_possession_percent, away: result.away_possession_percent, premium: false },
        { label: 'Territory %', home: result.home_territory_percent, away: result.away_territory_percent, premium: false },
        { label: 'Half-time', home: result.half_time_home, away: result.half_time_away, premium: false },
      ],
    },
    {
      title: 'Scoring',
      stats: [
        { label: 'Tries', home: result.home_tries, away: result.away_tries, premium: false },
        { label: 'Conversions', home: result.home_conversions, away: result.away_conversions, premium: false },
        { label: 'Penalties', home: result.home_penalties, away: result.away_penalties, premium: true },
        { label: 'Drop goals', home: result.home_drop_goals, away: result.away_drop_goals, premium: true },
      ],
    },
    {
      title: 'Scoring by Quarter',
      stats: [
        { label: 'Q1 (0–20 min)', home: quarterScores.home[0]!, away: quarterScores.away[0]!, premium: false },
        { label: 'Q2 (20–40 min)', home: quarterScores.home[1]!, away: quarterScores.away[1]!, premium: false },
        { label: 'Q3 (40–60 min)', home: quarterScores.home[2]!, away: quarterScores.away[2]!, premium: false },
        { label: 'Q4 (60+ min)', home: quarterScores.home[3]!, away: quarterScores.away[3]!, premium: false },
      ],
    },
    {
      title: 'Attack',
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
      stats: [
        { label: 'Kicks in play', home: result.home_kicks_in_play, away: result.away_kicks_in_play, premium: true },
        { label: 'Kicks to touch', home: result.home_kicks_to_touch, away: result.away_kicks_to_touch, premium: true },
        { label: 'Kick metres gained', home: result.home_kick_meters, away: result.away_kick_meters, premium: true },
      ],
    },
    {
      title: 'Set Piece',
      stats: [
        { label: 'Scrums won', home: result.home_scrums_won, away: result.away_scrums_won, premium: true },
        { label: 'Scrums lost', home: result.home_scrums_lost, away: result.away_scrums_lost, premium: true },
        { label: 'Lineouts won', home: result.home_lineouts_won, away: result.away_lineouts_won, premium: true },
        { label: 'Lineouts lost', home: result.home_lineouts_lost, away: result.away_lineouts_lost, premium: true },
      ],
    },
    {
      title: 'Defence',
      stats: [
        { label: 'Tackles made', home: result.home_tackles_made, away: result.away_tackles_made, premium: true },
        { label: 'Tackle success %', home: result.home_tackle_success_percent, away: result.away_tackle_success_percent, premium: true },
        { label: 'Turnovers won', home: result.home_turnovers_won, away: result.away_turnovers_won, premium: true },
        { label: 'Turnovers conceded', home: result.home_turnovers_conceded, away: result.away_turnovers_conceded, premium: true },
      ],
    },
    {
      title: 'Discipline',
      stats: [
        { label: 'Penalties conceded', home: result.home_penalties_conceded, away: result.away_penalties_conceded, premium: true },
        { label: 'Handling errors', home: result.home_handling_errors, away: result.away_handling_errors, premium: true },
        { label: 'Yellow cards', home: result.home_yellow_cards, away: result.away_yellow_cards, premium: true },
        { label: 'Red cards', home: result.home_red_cards, away: result.away_red_cards, premium: true },
      ],
    },
  ];

  return (
    <View style={styles.statsCard}>
      {/* Match-state bar — same pill silhouette across states, colour
          swaps per fixture status: full-time (grey), live (red + minute),
          half-time (amber). Reuses the Overview timeline's MilestoneBar
          treatment for consistency between the two panes. */}
      <StateBar fixture={fixture} />
      {sections.map((section) => (
        <View key={section.title} style={styles.statSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
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
    </View>
  );
}

// Stat-bar colour tokens — leader = green (matches win-outcome / rankings-up
// green used across the app), lagger = red (matches StatusColor.live), tie
// = secondary text (grey). Kept as module-level constants so all StatBar
// instances share the same three values.
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
      <View style={styles.lineupSectionPillWrap}>
        <View style={styles.lineupSectionPill}>
          <Ionicons name="people-circle-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.lineupSectionPillLabel}>Starting XV</Text>
        </View>
      </View>
      {startingRows.map(({ home, away }, i) => (
        <LineUpCompareRow key={`start-${i}`} home={home} away={away} playerById={playerById} />
      ))}

      <View style={styles.lineupSectionPillWrap}>
        <View style={styles.lineupSectionPill}>
          <Ionicons name="people-circle-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.lineupSectionPillLabel}>Bench</Text>
        </View>
      </View>
      {benchRows.map(({ home, away }, i) => (
        <LineUpCompareRow key={`bench-${i}`} home={home} away={away} playerById={playerById} />
      ))}

      {/* Coaching staff — hidden entirely if the feed returns nothing (real
          feeds may not carry it — PRD register #7). Synthetic dev data
          gives every team 4 roles: head, attack, defence, forwards. */}
      {(homeCoaches.data?.length ?? 0) + (awayCoaches.data?.length ?? 0) > 0 ? (
        <>
          <View style={styles.lineupSectionPillWrap}>
            <View style={styles.lineupSectionPill}>
              <Ionicons name="people-circle-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.lineupSectionPillLabel}>Coaching Staff</Text>
            </View>
          </View>
          {pairCoachesByRole(homeCoaches.data ?? [], awayCoaches.data ?? []).map(
            ({ role, home, away }) => (
              <CoachingCompareRow key={role} role={role} home={home} away={away} />
            ),
          )}
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
        <Text style={styles.lineupNumberLeft}>{home?.shirt_number ?? '·'}</Text>
        <Text style={styles.lineupPosPlayer} numberOfLines={1}>
          {homeLabel}
        </Text>
      </View>
      <View style={styles.lineupSideRight}>
        <Text style={[styles.lineupPosPlayer, styles.lineupPosPlayerRight]} numberOfLines={1}>
          {awayLabel}
        </Text>
        <Text style={styles.lineupNumberRight}>{away?.shirt_number ?? '·'}</Text>
      </View>
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
        {team ? <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.medium} /> : null}
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
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { paddingBottom: 60 },

  header: {
    // Hero section stays white against the grey page background — reads as
    // a top strip that owns the flags + score, distinct from the tab body.
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerMeta: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  matchupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    paddingHorizontal: Spacing.two,
  },
  matchupLabelsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    width: '100%',
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.two,
  },
  flagSlot: { flex: 1, alignItems: 'center' },
  labelCol: { flex: 1, alignItems: 'center', gap: 4 },
  teamShort: { fontSize: TextSize.sm, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide, color: Colors.light.textSecondary },
  teamName: { fontSize: TextSize.md, fontWeight: TextWeight.semibold, color: Colors.light.text, textAlign: 'center' },
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
  detailScoreBox: {
    ...ScoreBoxSize.card,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScoreBoxWinner: { backgroundColor: Colors.light.text },
  detailScoreText: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  detailScoreTextWinner: { color: Colors.light.textInverse },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: TextSize.xs, fontWeight: TextWeight.bold, letterSpacing: TextTracking.wide },
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
  subTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  subTabPillActive: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  subTabPillInactive: {
    // Grey fill against the white sub-tab strip — flipped from the Fixtures
    // page pattern because the surface underneath is now white, not grey.
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
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
  timelineContainer: { gap: 0 },
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
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },
  eventLabelRight: { textAlign: 'right' },
  cardGlyph: { width: 10, height: 14, borderRadius: 2 },
  subGlyph: { flexDirection: 'column', alignItems: 'center' },
  subLabelWrap: { gap: 2, flexShrink: 1 },
  subLabelWrapRight: { alignItems: 'flex-end' },
  subLabelLine: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },

  // Milestone bar — full-width pill with icon + label. Anchors the
  // timeline at kick-off / half-time / etc.
  milestoneRow: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  // Milestone pill — matches the inactive sub-tab pill treatment (white fill,
  // hairline border, pill radius) so the milestone bars in the Overview
  // timeline share visual language with the sub-tabs and Line-Up section
  // pills above them.
  milestoneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  milestoneText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
  },
  // State-bar variants — same pill silhouette, coloured fills that swap in
  // for live and half-time fixtures. Border is matched to the fill so the
  // hairline outline reads as continuous with the coloured surface.
  stateBarLive: { backgroundColor: StatusColor.live, borderColor: StatusColor.live },
  stateBarHalfTime: { backgroundColor: StatusColor.warning, borderColor: StatusColor.warning },
  stateBarInverseText: { color: Colors.light.textInverse },
  stateBarLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.light.textInverse,
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

  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statSection: { gap: Spacing.three, paddingTop: 4 },
  sectionTitle: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingTop: Spacing.one,
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
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  statValueRight: {
    width: 32,
    textAlign: 'right',
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  /** Both halves are equal flex so the CENTRE of the track is the meeting
   * point regardless of the values. Home pill anchors to the right edge of
   * the left half (i.e. adjacent to the centre); away anchors to the left
   * edge of the right half. `row-reverse` on the left half places the home
   * segment on the right — same visual effect. */
  barHalfLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 6,
  },
  barHalfRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 6,
  },
  barCentreGap: { width: 3, height: 6 },
  // Home / away comparative bars — on-token per design-system §5 (home =
  // primary text, away = secondary text). No brand accent yet; brand
  // identity (register #23) is still open.
  barSegHome: { backgroundColor: Colors.light.text, borderRadius: 999, height: 6 },
  barSegAway: { backgroundColor: Colors.light.textSecondary, borderRadius: 999, height: 6 },

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

  lineupContainer: { gap: Spacing.two },

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
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
  },
  coachingNameRight: { textAlign: 'right' },

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
  // "Starting XV" / "Bench" section headers styled as pills matching the
  // inactive sub-tab pills above the pane — white fill, hairline border,
  // pill radius. Centred in a wrap row so the pill sizes to the label.
  lineupSectionPillWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: Spacing.three,
    paddingBottom: 4,
  },
  lineupSectionPill: {
    // Row layout so an icon can sit inside the pill next to the label —
    // matches the Overview timeline's MilestoneBar pattern.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  lineupSectionPillLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
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
  lineupNumberLeft: {
    width: 24,
    textAlign: 'left',
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  lineupNumberRight: {
    width: 24,
    textAlign: 'right',
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  lineupPosPlayer: {
    // Placeholder for the eventual player-name — currently rendering the
    // canonical position label as a Title-Case stand-in. Matches the
    // sub-tab label spec (12pt semibold, textSecondary) so the row's
    // typographic register aligns with the tab strip above.
    flexShrink: 1,
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.textSecondary,
  },
  lineupPosPlayerRight: {
    textAlign: 'right',
  },

  rankingsPane: { gap: Spacing.three },
  rankingsMeta: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
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
  rankingName: { fontSize: TextSize.lg, fontWeight: TextWeight.bold, color: Colors.light.text },
  rankingSub: { fontSize: TextSize.xs, color: Colors.light.textSecondary, fontVariant: ['tabular-nums'] },
  rankingTrail: { alignItems: 'flex-end' },
  rankingPoints: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, fontVariant: ['tabular-nums'] },
  rankingPointsLabel: { fontSize: TextSize.xs, color: Colors.light.textSecondary, letterSpacing: TextTracking.wide },

  placeholder: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  placeholderTitle: { fontSize: TextSize.xl, fontWeight: TextWeight.bold, color: Colors.light.text, textAlign: 'center' },
  placeholderBody: { fontSize: TextSize.sm, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
});
