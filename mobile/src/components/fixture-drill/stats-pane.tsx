import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture, MatchEvent, Result } from '@rugby-app/shared';

import { useFixtureEvents } from '@/api/hooks';
import { LoadingState } from '@/components/state-views';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';

export function StatsPane({
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  paneEmpty: { paddingVertical: Spacing.four, alignItems: 'center' },
  paneEmptyText: { color: Colors.light.textSecondary, fontSize: TextSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 320 },

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
});
