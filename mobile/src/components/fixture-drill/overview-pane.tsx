import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture, MatchEvent, Player, Team } from '@rugby-app/shared';

import { useFixtureEvents } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

// ─── Overview pane — match-event timeline ────────────────────────────────────

/**
 * Chronological timeline of match events. Home team on the left, away on
 * the right, milestone bars (kick-off / half-time / etc.) full-width.
 * Default view is expanded; "Show Less" collapses to milestones + scoring
 * events only, hiding cards + substitutions for a match-summary read.
 */
export function OverviewPane({
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
  // 'second-half-start' is dropped outright — Half Time already marks
  // the break, and a second bar two rows later reads as noise.
  const ordered = [...all].reverse().filter((e) => e.type !== 'second-half-start');
  // The timeline is deliberately scoring + personnel only (owner call
  // 2026-07-08): milestones, tries, conversions, penalty/drop goals,
  // substitutions and cards. Everything else is chart material, not
  // timeline material — the old Show more/less tier is gone.
  const visible = ordered.filter(
    (e) =>
      e.type === 'kick-off' ||
      e.type === 'half-time' ||
      e.type === 'full-time' ||
      e.type === 'try' ||
      e.type === 'conversion' ||
      e.type === 'penalty-goal' ||
      e.type === 'drop-goal' ||
      e.type === 'substitution' ||
      e.type === 'yellow-card' ||
      e.type === 'red-card',
  );

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
          allEvents={all}
        />
      ))}
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
  allEvents,
}: {
  event: MatchEvent;
  fixture: Fixture;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  playerById: Map<string, Player>;
  allEvents: readonly MatchEvent[];
}) {
  const isMilestone =
    event.type === 'kick-off' ||
    event.type === 'half-time' ||
    event.type === 'full-time';
  if (isMilestone)
    return (
      <MilestoneBar
        type={event.type}
        fixture={fixture}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        allEvents={allEvents}
      />
    );
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

/** Cumulative scoring tallies for one side up to a cutoff minute. */
function tallyFor(
  events: readonly MatchEvent[],
  teamId: string | undefined,
  maxMinute: number,
): { tries: number; conversions: number; pens: number } {
  const t = { tries: 0, conversions: 0, pens: 0 };
  if (!teamId) return t;
  for (const e of events) {
    if (e.team_id !== teamId || e.minute > maxMinute) continue;
    if (e.type === 'try') t.tries++;
    else if (e.type === 'conversion') t.conversions++;
    else if (e.type === 'penalty-goal') t.pens++;
  }
  return t;
}

function TallyCluster({
  flag,
  tally,
  mirrored = false,
}: {
  flag: string | undefined;
  tally: { tries: number; conversions: number; pens: number };
  mirrored?: boolean;
}) {
  const pairs = (
    <>
      <View style={styles.tallyPair}>
        <Ionicons name="american-football" size={12} color={Colors.light.textSecondary} />
        <Text style={styles.tallyCount}>{tally.tries}</Text>
      </View>
      <View style={styles.tallyPair}>
        <Ionicons name="american-football-outline" size={12} color={Colors.light.textSecondary} />
        <Text style={styles.tallyCount}>{tally.conversions}</Text>
      </View>
      <View style={styles.tallyPair}>
        <Ionicons name="flag-outline" size={12} color={Colors.light.textSecondary} />
        <Text style={styles.tallyCount}>{tally.pens}</Text>
      </View>
    </>
  );
  return (
    <View style={styles.tallyCluster}>
      {mirrored ? pairs : null}
      {flag ? <TeamFlagShield flagCode={flag} width={16} /> : null}
      {mirrored ? null : pairs}
    </View>
  );
}

function MilestoneBar({
  type,
  fixture,
  homeTeam,
  awayTeam,
  allEvents,
}: {
  type: MatchEvent['type'];
  fixture: Fixture;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  allEvents: readonly MatchEvent[];
}) {
  const labels: Partial<Record<MatchEvent['type'], string>> = {
    'kick-off': 'Match Start',
    'half-time': 'Half Time',
    'full-time': 'Full Time',
  };
  // HT and FT carry each side's cumulative scoring tally (shield +
  // tries / conversions / penalties icon pairs) flanking the label.
  const showTallies = type === 'half-time' || type === 'full-time';
  const cutoff = type === 'half-time' ? 40 : Number.POSITIVE_INFINITY;
  const homeTally = tallyFor(allEvents, fixture.home_team_id, cutoff);
  const awayTally = tallyFor(allEvents, fixture.away_team_id, cutoff);
  return (
    <>
      {/* Half Time and Kick Off get a hairline ABOVE too — bracketing
          the break and the match start. */}
      {type === 'half-time' || type === 'kick-off' ? (
        <View style={[styles.insetDivider, styles.insetDividerAbove]} />
      ) : null}
      <View style={[styles.milestoneRow, showTallies && styles.milestoneRowSpread]}>
        {showTallies ? (
          <TallyCluster flag={homeTeam?.flag_code} tally={homeTally} />
        ) : null}
        <Text style={styles.categoryLabel}>{labels[type] ?? type}</Text>
        {showTallies ? (
          <TallyCluster flag={awayTeam?.flag_code} tally={awayTally} mirrored />
        ) : null}
      </View>
      {/* Kick Off closes the (newest-first) timeline — nothing below
          it, so no under-line. */}
      {type !== 'kick-off' ? <View style={styles.insetDivider} /> : null}
    </>
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
      return <Ionicons name="american-football" size={16} color={Colors.light.textSecondary} />;
    case 'conversion':
    case 'drop-goal':
      return <Ionicons name="american-football-outline" size={14} color={Colors.light.textSecondary} />;
    case 'penalty-goal':
      return <Ionicons name="flag-outline" size={14} color={Colors.light.textSecondary} />;
    case 'yellow-card':
      return <View style={[styles.cardGlyph, { backgroundColor: StatusColor.warning }]} />;
    case 'red-card':
      return <View style={[styles.cardGlyph, { backgroundColor: StatusColor.live }]} />;
    case 'substitution':
      // Two arrows stacked — up for player coming ON (green),
      // down for player going OFF (red).
      return (
        <View style={styles.subGlyph}>
          <Ionicons name="arrow-up" size={12} color="#5CB04E" />
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    borderColor: '#E3E8EF',
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
    fontFamily: 'WorkSans_500Medium',
    width: 48,
    textAlign: 'center',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
  },
  eventLabel: {
    fontFamily: 'WorkSans_500Medium',
    flexShrink: 1,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  eventLabelRight: { textAlign: 'right' },
  cardGlyph: { width: 10, height: 14, borderRadius: 2 },
  subGlyph: { flexDirection: 'column', alignItems: 'center' },
  subLabelWrap: { gap: 2, flexShrink: 1 },
  subLabelWrapRight: { alignItems: 'flex-end' },
  subLabelLine: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.sm,
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
  // Show More / Show Less toggle at the bottom of the timeline.

  // Standalone inset divider under each milestone header — chevron-
  // chrome grey, same grammar as the Line-Up section headers.
  insetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  insetDividerAbove: {
    marginBottom: 0,
    marginTop: Spacing.two,
  },
  milestoneRowSpread: {
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  tallyCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tallyPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tallyCount: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  categoryLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
});
