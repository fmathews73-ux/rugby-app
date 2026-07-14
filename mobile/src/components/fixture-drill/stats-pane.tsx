import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture, MatchEvent, Result } from '@rugby-app/shared';

import { useFixtureEvents, useTeam } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { LoadingState } from '@/components/state-views';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, ScoreBug, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { INSUFFICIENT_INSIGHT, insufficientData } from '@/lib/fit-narrative';

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
  const homeTeam = useTeam(fixture.home_team_id);
  const awayTeam = useTeam(fixture.away_team_id);
  const homeCode = homeTeam.data?.short_name ?? fixture.home_team_id.toUpperCase();
  const awayCode = awayTeam.data?.short_name ?? fixture.away_team_id.toUpperCase();
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
        'Ball share, ground share and the half-time ledger: the control measures every other read hangs off. A side can dominate both and still lose; this card is where that tension shows first.',
      stats: [
        { label: 'Possession %', home: result.home_possession_percent, away: result.away_possession_percent, premium: false },
        { label: 'Territory %', home: result.home_territory_percent, away: result.away_territory_percent, premium: false },
        { label: 'Half-time', home: result.half_time_home, away: result.half_time_away, premium: false },
      ],
    },
    {
      title: 'Scoring',
      description:
        'How the points were assembled: tries (5), conversions (2), penalty and drop goals (3), and the goal-kicking return. Penalty-heavy scoring means territory without breaches; unconverted tries are points left behind.',
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
        'Points by 20-minute block, kick-off to the closing stretch. Fast starters, half-time-reset sides and closers all leave their fingerprint here.',
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
        'Ground gained and what it produced: red-zone visits and their points yield, metres before and after contact, breaks, beaten defenders, the gainline share and the carry-pass-offload volume. Around 2 points per 22 visit is Test par; 3+ is clinical.',
      stats: [
        { label: '22 entries', home: result.home_twenty_two_entries, away: result.away_twenty_two_entries, premium: false },
        {
          label: 'Points per 22 entry',
          home: Math.round((result.home_points_from_twenty_two_entries / Math.max(1, result.home_twenty_two_entries)) * 10) / 10,
          away: Math.round((result.away_points_from_twenty_two_entries / Math.max(1, result.away_twenty_two_entries)) * 10) / 10,
          premium: false,
        },
        { label: 'Metres made', home: result.home_meters, away: result.away_meters, premium: true },
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
        'The field-position lever: kick volume, touch-finders, metres off the boot and the 50/22 count, plus the aerial exchange — contestables put up, own kicks won back, receptions held under the other side\'s bombs.',
      stats: [
        { label: 'Kicks in play', home: result.home_kicks_in_play, away: result.away_kicks_in_play, premium: true },
        { label: 'Kicks to touch', home: result.home_kicks_to_touch, away: result.away_kicks_to_touch, premium: true },
        { label: 'Kick metres', home: result.home_kick_meters, away: result.away_kick_meters, premium: true },
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
        'Scrum and lineout security, both directions. Winning your own ball is the entry fee; losing it is a turnover in prime territory, and stealing theirs swings momentum with it.',
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
        'The ruck-and-maul engine room: rucks kept and lost, the share recycled inside 3 seconds — the best single predictor of attacking tempo — and the maul ledger.',
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
        'The tackle ledger: volume, completion rate and the dominant hits that drove carriers backwards, against the turnover exchange both ways. 85% completion is the Tier-1 baseline.',
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
        'The penalty ledger with its three main causes split out, plus handling errors and cards. Lower is the win on every row; under 8 penalties a game is well-drilled, over 12 hands the opponent territory and shots at goal.',
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
          <FlipTrigger />
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
    <FadeCard
      key={section.title}
      flipped={flippedSection?.title === section.title}
      back={
        <NarrativeBack
          title={section.title}
          onClose={() => setFlippedTitle(null)}
          purpose={section.description}
          read={buildCategoryRead(section, homeCode, awayCode, fixture.status === 'completed')}
        />
      }
      front={<View style={styles.statsCard}>{renderSection(section)}</View>}
    />
  );

  return (
    <View style={styles.statsPaneStack}>
      {sections.map(renderCard)}
    </View>
  );
}

/**
 * Stats-category Insights read, built from the category's own rows —
 * leader ledger first, widest split second, second front and level
 * measures after (priority order per narrative spec §5.7). Tense
 * follows the match state: settled at full-time, running while live.
 */
export function buildCategoryRead(
  section: {
    title: string;
    stats: { label: string; home: number; away: number; inverted?: boolean }[];
  },
  homeCode: string,
  awayCode: string,
  completed: boolean,
): string | null {
  const rows = section.stats;
  // Sparse-data honesty (owner rule 2026-07-14): no rows, or a
  // mostly-zero sheet, says so instead of building hollow prose.
  if (rows.length === 0) return INSUFFICIENT_INSIGHT;
  if (insufficientData(rows.flatMap((r) => [r.home, r.away]))) {
    return INSUFFICIENT_INSIGHT;
  }

  const leaderOf = (r: (typeof rows)[number]) => {
    if (r.home === r.away) return null;
    const homeBetter = r.inverted ? r.home < r.away : r.home > r.away;
    return homeBetter ? 'home' : 'away';
  };
  const homeLed = rows.filter((r) => leaderOf(r) === 'home');
  const awayLed = rows.filter((r) => leaderOf(r) === 'away');
  const level = rows.filter((r) => leaderOf(r) === null);

  // Relative gap ranks the splits so percentages and raw counts can
  // compete on one scale.
  const gapOf = (r: (typeof rows)[number]) =>
    Math.abs(r.home - r.away) / Math.max(Math.abs(r.home), Math.abs(r.away), 1);
  const contested = rows.filter((r) => leaderOf(r) !== null).sort((a, b) => gapOf(b) - gapOf(a));

  const fmtV = (v: number) => String(Math.round(v));
  const holds = completed ? 'finished with' : 'holds';
  const sentences: string[] = [];

  if (homeLed.length === 0 && awayLed.length === 0) {
    sentences.push(
      `Nothing separates the sides here: every ${section.title.toLowerCase()} measure on the card is level.`,
    );
  } else {
    const lead =
      homeLed.length === awayLed.length
        ? `The ${section.title.toLowerCase()} ledger splits even, ${homeLed.length} measure${homeLed.length === 1 ? '' : 's'} each`
        : homeLed.length > awayLed.length
          ? `${homeCode} ${completed ? 'took' : 'lead'} the ${section.title.toLowerCase()} ledger ${homeLed.length}-${awayLed.length}`
          : `${awayCode} ${completed ? 'took' : 'lead'} the ${section.title.toLowerCase()} ledger ${awayLed.length}-${homeLed.length}`;
    sentences.push(`${lead}${level.length > 0 ? ` with ${level.length} level` : ''}.`);
  }

  const top = contested[0];
  if (top) {
    const leader = leaderOf(top) === 'home' ? homeCode : awayCode;
    sentences.push(
      `The widest split is ${top.label}: ${fmtV(top.home)} against ${fmtV(top.away)}, ${leader}'s number${top.inverted ? ', and on this row lower is the win' : ''}.`,
    );
  }
  const second = contested[1];
  if (second) {
    const leader = leaderOf(second) === 'home' ? homeCode : awayCode;
    sentences.push(`Next comes ${second.label}, where ${leader} ${holds} ${fmtV(leaderOf(second) === 'home' ? second.home : second.away)} to ${fmtV(leaderOf(second) === 'home' ? second.away : second.home)}.`);
  }
  const closest = contested[contested.length - 1];
  if (closest && contested.length > 2 && gapOf(closest) < 0.1) {
    sentences.push(`Tightest of the contested rows is ${closest.label}, ${fmtV(closest.home)} to ${fmtV(closest.away)}, close enough to swing ${completed ? 'a rematch' : 'before full-time'}.`);
  }

  return sentences.join(' ');
}

// Stat-bar colour tokens — same solid pair the Efficiency KPI card uses so
// the two adjacent surfaces read as one visual system. Leader green =
// GOOD_COLOR from that card; lagger red = BAD_COLOR (StatusColor.live);
// tie renders in secondary text grey.
const LEADING_COLOR = '#5CB04E';
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
  // Each half's flex share against its spacer IS the bar length,
  // growing out from the centre gap towards its flag. The arrival
  // sweep is a scaleX TRANSFORM on the flex-sized segment (native
  // driver) — the earlier JS-driven flex ramp was rejected as jittery;
  // transforms never touch layout so the flex geometry stays static.
  // 15% grey headroom (MAX_FILL 0.85) — even the max value leaves
  // visible track at the outer edge, so bars read against a scale
  // instead of slamming the ends.
  const MAX_FILL = 0.85;
  const ink = useChartInk();
  const homeSegFlex = Math.max(0.001, MAX_FILL * (home / maxValue));
  const homeSpacerFlex = Math.max(0.001, 1 - MAX_FILL * (home / maxValue));
  const awaySegFlex = Math.max(0.001, MAX_FILL * (away / maxValue));
  const awaySpacerFlex = Math.max(0.001, 1 - MAX_FILL * (away / maxValue));

  // Leading / lagging colouring: the higher value wins the green bar, the
  // lower gets the red. Ties render both bars in the neutral secondary text
  // colour so "no leader" reads distinctly. Uses the app's existing win /
  // loss tokens for consistency with the form sparkline + momentum arrows.
  // Verdicts compare the ROUNDED display values (owner rule
  // 2026-07-14): if both sides show the same whole number, both boxes
  // stay quiet — no dark box on a difference the user can't see.
  const homeR = Math.round(home);
  const awayR = Math.round(away);
  const homeBetter = inverted ? homeR < awayR : homeR > awayR;
  const awayBetter = inverted ? awayR < homeR : awayR > homeR;
  const homeColor = homeBetter ? LEADING_COLOR : awayBetter ? LAGGING_COLOR : TIE_COLOR;
  const awayColor = awayBetter ? LEADING_COLOR : homeBetter ? LAGGING_COLOR : TIE_COLOR;

  return (
    <View style={styles.statBlock}>
      {/* Label stays crisp so locked users can still see the metric name. */}
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarRowWrap}>
        <View style={styles.statBarRow}>
          <View style={[styles.statValueBox, ScoreBug.cutLeft, homeBetter ? styles.statValueBoxWin : null]}>
            <Text style={[styles.statValue, homeBetter ? styles.statValueTextWin : null]}>
              <CountUpValue value={String(homeR)} ink={ink} />
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View style={styles.barHalfLeft}>
              <Animated.View
                style={[
                  styles.barSegHome,
                  {
                    flex: homeSegFlex,
                    backgroundColor: homeColor,
                    // Anchored on the centre gap; sweeps outward.
                    transformOrigin: 'right',
                    transform: [{ scaleX: ink }],
                  },
                ]}
              />
              <View style={{ flex: homeSpacerFlex }} />
            </View>
            <View style={styles.barCentreGap} />
            <View style={styles.barHalfRight}>
              <Animated.View
                style={[
                  styles.barSegAway,
                  {
                    flex: awaySegFlex,
                    backgroundColor: awayColor,
                    transformOrigin: 'left',
                    transform: [{ scaleX: ink }],
                  },
                ]}
              />
              <View style={{ flex: awaySpacerFlex }} />
            </View>
          </View>
          <View style={[styles.statValueBox, ScoreBug.cutRight, awayBetter ? styles.statValueBoxWin : null]}>
            <Text style={[styles.statValue, awayBetter ? styles.statValueTextWin : null]}>
              <CountUpValue value={String(awayR)} ink={ink} />
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
    borderColor: '#E3E8EF',
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
    fontFamily: 'WorkSans_500Medium',
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
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#E9EDF2',
    alignItems: 'center',
    justifyContent: 'center',
    ...ScoreBug.skew,
  },
  statValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  statValueTextWin: { color: Colors.light.textInverse },
  statValue: {
    // Match-score face — condensed italic at the row-score size.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
    ...ScoreBug.counterSkew,
  },

  // Track matches the Efficiency KPI row: 4pt-tall grey slab, small
  // corner radius (not pill), tight breathing room from the flanking
  // values. Diverging halves are preserved so each side still grows out
  // from the centre — the shared thinness ties the two cards visually.
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EFF2F6',
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

  // NO overflow/radius on the wrap — clipping here rounded the value
  // boxes' sharp wing cuts back off (owner catch 2026-07-14); the
  // premium blur carries its own rounding instead.
  statBarRowWrap: {
    position: 'relative',
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
    borderRadius: 8,
    overflow: 'hidden',
  },
});
