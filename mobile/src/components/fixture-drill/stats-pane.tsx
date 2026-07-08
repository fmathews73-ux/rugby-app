import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture, MatchEvent, Result } from '@rugby-app/shared';

import { useFixtureEvents } from '@/api/hooks';
import { FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { LoadingState } from '@/components/state-views';
import { AppLogo } from '@/components/app-logo';
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
  // Which category's card is FLIPPED to its narrative back; null when
  // every card shows its front.
  const [flippedTitle, setFlippedTitle] = useState<string | null>(null);
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
    stats: { label: string; home: number; away: number; premium: boolean; inverted?: boolean }[];
  }[] = [
    {
      title: 'Overview',
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
        {
          label: 'Goal kicking %',
          home: Math.round(((result.home_conversions + result.home_penalties) / Math.max(1, result.home_conversion_attempts + result.home_penalty_goal_attempts)) * 100),
          away: Math.round(((result.away_conversions + result.away_penalties) / Math.max(1, result.away_conversion_attempts + result.away_penalty_goal_attempts)) * 100),
          premium: false,
        },
      ],
    },
    {
      title: 'Quarters',
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
        'The "how did they move forward" numbers. 22 entries = visits into the opposition 22 — the red zone. Points per 22 entry = how many points each visit yielded on average; around 2 is par at Test level, 3+ is clinical, and a side entering often but scoring little is leaving results on the table. Metres = total ground gained ball-in-hand. Post-contact metres = the subset won AFTER the first hit — the leg-drive read. Line breaks = clean breaches of the defensive line. Defenders beaten = tackle attempts evaded. Gainline % = share of carries that crossed the advantage line. Carries = ball-carry actions. Passes = successful passes made. Offloads = ball passed in the tackle. A high metres-per-carry ratio is a sign of a dominant carrying pack; lots of offloads points to a team happy to keep the ball alive.',
      stats: [
        { label: '22 entries', home: result.home_twenty_two_entries, away: result.away_twenty_two_entries, premium: false },
        {
          label: 'Points per 22 entry',
          home: Math.round((result.home_points_from_twenty_two_entries / Math.max(1, result.home_twenty_two_entries)) * 10) / 10,
          away: Math.round((result.away_points_from_twenty_two_entries / Math.max(1, result.away_twenty_two_entries)) * 10) / 10,
          premium: false,
        },
        { label: 'Meters made', home: result.home_meters, away: result.away_meters, premium: true },
        { label: 'Post-contact metres', home: result.home_post_contact_metres, away: result.away_post_contact_metres, premium: true },
        { label: 'Line breaks', home: result.home_line_breaks, away: result.away_line_breaks, premium: true },
        { label: 'Defenders beaten', home: result.home_defenders_beaten, away: result.away_defenders_beaten, premium: true },
        { label: 'Gainline success %', home: result.home_gainline_success_percent, away: result.away_gainline_success_percent, premium: true },
        { label: 'Carries', home: result.home_carries, away: result.away_carries, premium: true },
        { label: 'Passes', home: result.home_passes, away: result.away_passes, premium: true },
        { label: 'Offloads', home: result.home_offloads, away: result.away_offloads, premium: true },
      ],
    },
    {
      title: 'Kicking',
      description:
        'The kicking game — the "field-position lever" of rugby. Kicks in play = kicks that stayed on the field (chases, contestable box kicks, cross-field kicks). Kicks to touch = ball put out of bounds for a lineout. Kick metres gained = total ground won from kicks. 50/22s = kicks from your own half bouncing into touch inside the opposition 22, winning your own lineout throw — rare, and a momentum event every time. Contestables kicked = kicks put up to be fought for in the air; own kicks regathered = the ones the kicking side won back; receptions secured = high balls safely claimed when the OTHER side kicked. Big kicking numbers usually mean a team playing a territorial game rather than running everything.',
      stats: [
        { label: 'Kicks in play', home: result.home_kicks_in_play, away: result.away_kicks_in_play, premium: true },
        { label: 'Kicks to touch', home: result.home_kicks_to_touch, away: result.away_kicks_to_touch, premium: true },
        { label: 'Kick metres gained', home: result.home_kick_meters, away: result.away_kick_meters, premium: true },
        { label: '50/22 kicks', home: result.home_fifty_twenty_twos, away: result.away_fifty_twenty_twos, premium: true },
        // Aerial contest — a side's receptions derive from the
        // OPPONENT's delivered contestables (register #33).
        { label: 'Contestables kicked', home: result.home_contestable_kicks, away: result.away_contestable_kicks, premium: true },
        { label: 'Own kicks regathered', home: result.home_contestable_kicks_won, away: result.away_contestable_kicks_won, premium: true },
        {
          label: 'Receptions secured',
          home: result.away_contestable_kicks - result.away_contestable_kicks_won,
          away: result.home_contestable_kicks - result.home_contestable_kicks_won,
          premium: true,
        },
      ],
    },
    {
      title: 'Set-Piece',
      description:
        'How each team fared at the set-piece phases — scrums and lineouts. Winning your own scrum or lineout is expected; losing it is a turnover in prime attacking territory. Winning the OPPONENT\'S is worth its weight in gold — steals disrupt phase play and momentum.',
      stats: [
        { label: 'Scrums won', home: result.home_scrums_won, away: result.away_scrums_won, premium: true },
        { label: 'Scrums lost', home: result.home_scrums_lost, away: result.away_scrums_lost, premium: true, inverted: true },
        { label: 'Lineouts won', home: result.home_lineouts_won, away: result.away_lineouts_won, premium: true },
        { label: 'Lineouts lost', home: result.home_lineouts_lost, away: result.away_lineouts_lost, premium: true, inverted: true },
      ],
    },
    {
      title: 'Breakdown',
      description:
        'The ruck-and-maul engine room. Rucks won = attacking rucks where possession was retained; rucks lost = breakdown turnovers conceded (a Tier-1 side retains 90%+). Quick ball % = share of attacking rucks recycled inside 3 seconds — the single best predictor of attacking tempo, because slow ball lets the defence reset. Mauls won = driving mauls (usually off a lineout) that ended with possession retained or a penalty; mauls lost = held up or turned over.',
      stats: [
        { label: 'Rucks won', home: result.home_rucks_won, away: result.away_rucks_won, premium: false },
        { label: 'Rucks lost', home: result.home_rucks_lost, away: result.away_rucks_lost, premium: false, inverted: true },
        { label: 'Quick ball % (0-3s)', home: result.home_ruck_speed_0_3s_percent, away: result.away_ruck_speed_0_3s_percent, premium: true },
        { label: 'Mauls won', home: result.home_mauls_won, away: result.away_mauls_won, premium: false },
        { label: 'Mauls lost', home: result.home_mauls_lost, away: result.away_mauls_lost, premium: false, inverted: true },
      ],
    },
    {
      title: 'Defence',
      description:
        'The defensive read. Tackles made = total completed tackles. Tackle success % = the share of attempted tackles that stuck (85% is a solid Tier-1 baseline; below 80% usually means a leaky defensive shape). Dominant tackles = hits that drove the carrier backwards — the momentum-swinging subset. Turnovers won = ball reclaimed at the breakdown or via steals. Turnovers conceded = ball lost in contact — the flip side of the same coin.',
      stats: [
        { label: 'Tackles made', home: result.home_tackles_made, away: result.away_tackles_made, premium: true },
        { label: 'Tackle success %', home: result.home_tackle_success_percent, away: result.away_tackle_success_percent, premium: true },
        { label: 'Dominant tackles', home: result.home_dominant_tackles, away: result.away_dominant_tackles, premium: true },
        { label: 'Turnovers won', home: result.home_turnovers_won, away: result.away_turnovers_won, premium: true },
        { label: 'Turnovers conceded', home: result.home_turnovers_conceded, away: result.away_turnovers_conceded, premium: true, inverted: true },
      ],
    },
    {
      title: 'Discipline',
      description:
        'How well each team stayed inside the laws. Penalties conceded = referee whistles against, with the three primary causes split out beneath (scrum, breakdown, offside — the remainder is other offences). Handling errors = knock-ons and forward passes. Yellow cards = 10-minute sin-bin. Red cards = permanent dismissal. A well-drilled team tends to sit below 8 penalties a game; anything over 12 hands the opponent easy territory and shots at goal.',
      stats: [
        { label: 'Penalties conceded', home: result.home_penalties_conceded, away: result.away_penalties_conceded, premium: true, inverted: true },
        { label: 'Scrum penalties', home: result.home_scrum_penalties_conceded, away: result.away_scrum_penalties_conceded, premium: true, inverted: true },
        { label: 'Breakdown penalties', home: result.home_breakdown_penalties_conceded, away: result.away_breakdown_penalties_conceded, premium: true, inverted: true },
        { label: 'Offside penalties', home: result.home_offside_penalties_conceded, away: result.away_offside_penalties_conceded, premium: true, inverted: true },
        { label: 'Handling errors', home: result.home_handling_errors, away: result.away_handling_errors, premium: true, inverted: true },
        { label: 'Yellow cards', home: result.home_yellow_cards, away: result.away_yellow_cards, premium: true, inverted: true },
        { label: 'Red cards', home: result.home_red_cards, away: result.away_red_cards, premium: true, inverted: true },
      ],
    },
  ];

  const flippedSection = sections.find((s) => s.title === flippedTitle) ?? null;

  // ONE card per category (owner call 2026-07-08) — every section owns
  // its own card and flip, rendered as a vertical stack: stats are
  // scan-and-compare reads, so scrolling beats a carousel here.

  const renderSection = (section: (typeof sections)[number]) => (
    <View key={section.title} style={styles.sectionBlock}>
      <View style={styles.categoryHeaderRow}>
        <Text style={styles.categoryLabel}>{section.title}</Text>
        <Pressable
          onPress={() => setFlippedTitle(section.title)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Read about ${section.title}`}>
          <AppLogo height={14} />
        </Pressable>
      </View>
      {section.stats.map((s) => (
        <StatBar
          key={s.label}
          label={s.label}
          home={s.home}
          away={s.away}
          inverted={s.inverted}
          locked={s.premium && !IS_SUBSCRIBED}
        />
      ))}
    </View>
  );

  const renderCard = (section: (typeof sections)[number]) => (
    <FlipCard
      key={section.title}
      flipped={flippedSection?.title === section.title}
      back={
        <NarrativeBack
          title={section.title}
          onClose={() => setFlippedTitle(null)}
          purpose={section.description}
        />
      }
      front={<View style={styles.statsCard}>{renderSection(section)}</View>}
    />
  );

  return <View style={styles.statsPaneStack}>{sections.map(renderCard)}</View>;
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
  inverted = false,
  locked = false,
}: {
  label: string;
  home: number;
  away: number;
  /** Lower is better (losses, concessions, infractions) — flips the
   *  leading/lagging verdict on bars and value tiles. */
  inverted?: boolean;
  locked?: boolean;
}) {
  const maxValue = Math.max(home, away, 1);
  // Static fills — each half's flex share against its spacer IS the bar
  // length, growing out from the centre gap towards its flag. Motion
  // graphics were tried here (JS-driven flex ramp on mount, then
  // scroll-triggered reveal) and rejected as jittery; if fill animation
  // ever returns, it needs a UI-thread driver (reanimated), not
  // Animated-with-JS-driver on a layout prop.
  // 15% grey headroom (MAX_FILL 0.85) — even the max value leaves
  // visible track at the outer edge, so bars read against a scale
  // instead of slamming the ends.
  const MAX_FILL = 0.85;
  const homeSegFlex = Math.max(0.001, MAX_FILL * (home / maxValue));
  const homeSpacerFlex = Math.max(0.001, 1 - MAX_FILL * (home / maxValue));
  const awaySegFlex = Math.max(0.001, MAX_FILL * (away / maxValue));
  const awaySpacerFlex = Math.max(0.001, 1 - MAX_FILL * (away / maxValue));

  // Leading / lagging colouring: the higher value wins the green bar, the
  // lower gets the red. Ties render both bars in the neutral secondary text
  // colour so "no leader" reads distinctly. Uses the app's existing win /
  // loss tokens for consistency with the form sparkline + momentum arrows.
  const homeBetter = inverted ? home < away : home > away;
  const awayBetter = inverted ? away < home : away > home;
  const homeColor = homeBetter ? LEADING_COLOR : awayBetter ? LAGGING_COLOR : TIE_COLOR;
  const awayColor = awayBetter ? LEADING_COLOR : homeBetter ? LAGGING_COLOR : TIE_COLOR;

  return (
    <View style={styles.statBlock}>
      {/* Label stays crisp so locked users can still see the metric name. */}
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarRowWrap}>
        <View style={styles.statBarRow}>
          <View style={[styles.statValueBox, homeBetter ? styles.statValueBoxWin : null]}>
            <Text style={[styles.statValue, homeBetter ? styles.statValueTextWin : null]}>
              {home}
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={styles.barHalfLeft}>
              <View
                style={[styles.barSegHome, { flex: homeSegFlex, backgroundColor: homeColor }]}
              />
              <View style={{ flex: homeSpacerFlex }} />
            </View>
            <View style={styles.barCentreGap} />
            <View style={styles.barHalfRight}>
              <View
                style={[styles.barSegAway, { flex: awaySegFlex, backgroundColor: awayColor }]}
              />
              <View style={{ flex: awaySpacerFlex }} />
            </View>
          </View>
          <View style={[styles.statValueBox, awayBetter ? styles.statValueBoxWin : null]}>
            <Text style={[styles.statValue, awayBetter ? styles.statValueTextWin : null]}>
              {away}
            </Text>
          </View>
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
  // One category inside a (possibly two-category) card — carries the
  // same internal rhythm the standalone category cards had.
  sectionBlock: { gap: Spacing.two },
  categoryLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Header row of each Stats category card: the label sits at the top-left
  // with a small info icon immediately next to it. Same pattern as the
  // Form / Momentum / KPI card headers on the Preview and Insights panes.
  // Title left, reader icon pinned to the right edge — the app-wide
  // card-header slot.
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    // Muted — the label is context, the numbers on either side are the
    // read. Lets the values pop visually without shouting.
    color: Colors.light.textSecondary,
    textAlign: 'center',
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
  // Value tiles — the quiet losing-score pairing (light fill, grey
  // Barlow digits), matching every other bar chart's value rail.
  statValueBox: {
    width: 36,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  statValueTextWin: { color: Colors.light.textInverse },
  statValue: {
    // Match-score face — condensed italic at the row-score size.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
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
