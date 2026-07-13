import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import type { Fixture, Result } from '@rugby-app/shared';

import { useFixtureResult } from '@/api/hooks';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { CardHeaderActions } from '@/components/card-header-actions';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { PAIR_PURPOSES } from '@/lib/analysis-section-info';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import type { AxisKey } from '@/hooks/use-match-analysis';

// Standard bar-row tokens (same as Profile H2H / Axis H2H / KPIs).
const AHEAD_COLOR = '#059669';
const BEHIND_COLOR = '#DC2626';
const EVEN_COLOR = Colors.light.textSecondary;
const MAX_FILL = 0.85;

type SideGet = (r: Result, side: 'home' | 'away') => number;

interface RowDef {
  label: string;
  get: SideGet;
  percent?: boolean;
  inverted?: boolean;
}

const setPiecePercent = (won: number, lost: number): number =>
  won + lost > 0 ? (won / (won + lost)) * 100 : 0;

const scrumPct: SideGet = (r, s) =>
  s === 'home'
    ? setPiecePercent(r.home_scrums_won, r.home_scrums_lost)
    : setPiecePercent(r.away_scrums_won, r.away_scrums_lost);
const lineoutPct: SideGet = (r, s) =>
  s === 'home'
    ? setPiecePercent(r.home_lineouts_won, r.home_lineouts_lost)
    : setPiecePercent(r.away_lineouts_won, r.away_lineouts_lost);
const goalKickPct: SideGet = (r, s) => {
  const made = s === 'home' ? r.home_conversions + r.home_penalties : r.away_conversions + r.away_penalties;
  const att =
    s === 'home'
      ? r.home_conversion_attempts + r.home_penalty_goal_attempts
      : r.away_conversion_attempts + r.away_penalty_goal_attempts;
  return att > 0 ? (made / att) * 100 : 0;
};
const ppe: SideGet = (r, s) => {
  const pts = s === 'home' ? r.home_points_from_twenty_two_entries : r.away_points_from_twenty_two_entries;
  const entries = s === 'home' ? r.home_twenty_two_entries : r.away_twenty_two_entries;
  return entries > 0 ? pts / entries : 0;
};
const field =
  (home: keyof Result, away: keyof Result): SideGet =>
  (r, s) =>
    (s === 'home' ? (r[home] as number) : (r[away] as number));

/** This match's reads behind each axis pair — the fixture-scoped twin
 *  of the pre-match AXIS_ROWS (per-game averages there, live match
 *  totals here). */
const MATCH_PAIR_ROWS: Record<string, readonly RowDef[]> = {
  'Attack & Defence': [
    { label: 'Points scored', get: field('home_score', 'away_score') },
    { label: 'Tries', get: field('home_tries', 'away_tries') },
    { label: 'Metres made', get: field('home_meters', 'away_meters') },
    { label: 'Line breaks', get: field('home_line_breaks', 'away_line_breaks') },
    { label: 'Defenders beaten', get: field('home_defenders_beaten', 'away_defenders_beaten') },
    { label: 'Tackle success', get: field('home_tackle_success_percent', 'away_tackle_success_percent'), percent: true },
  ],
  'Set-Piece & Discipline': [
    { label: 'Scrum success', get: scrumPct, percent: true },
    { label: 'Lineout success', get: lineoutPct, percent: true },
    { label: 'Penalties conceded', get: field('home_penalties_conceded', 'away_penalties_conceded'), inverted: true },
    { label: 'Yellow cards', get: field('home_yellow_cards', 'away_yellow_cards'), inverted: true },
    { label: 'Red cards', get: field('home_red_cards', 'away_red_cards'), inverted: true },
  ],
  'Kicking & Territory': [
    { label: 'Kicks in play', get: field('home_kicks_in_play', 'away_kicks_in_play') },
    { label: 'Kick metres', get: field('home_kick_meters', 'away_kick_meters') },
    { label: 'Goal kicking', get: goalKickPct, percent: true },
    { label: 'Territory', get: field('home_territory_percent', 'away_territory_percent'), percent: true },
    { label: '22 entries', get: field('home_twenty_two_entries', 'away_twenty_two_entries') },
    { label: 'Points per 22 entry', get: ppe },
  ],
  // The contestable slice of the air battle — receptions derived from
  // the OPPONENT's contestables (reconciliation principle), mirroring
  // the stats pane's Kicking rows.
  // Mirror-ledger order (pre-match aerial grammar): volume exchange
  // then outcome exchange. Zero values render as zero bars — rows are
  // NEVER dropped for empty data (owner rule 2026-07-09).
  'Aerial Contest': [
    { label: 'Contestables kicked', get: field('home_contestable_kicks', 'away_contestable_kicks') },
    {
      label: 'Contestables received',
      get: (r, side) =>
        side === 'home' ? r.away_contestable_kicks : r.home_contestable_kicks,
    },
    { label: 'Own kicks regathered', get: field('home_contestable_kicks_won', 'away_contestable_kicks_won') },
    {
      label: 'Receptions secured',
      get: (r, side) =>
        side === 'home'
          ? r.away_contestable_kicks - r.away_contestable_kicks_won
          : r.home_contestable_kicks - r.home_contestable_kicks_won,
    },
  ],
  'Possession & Turnovers': [
    { label: 'Possession', get: field('home_possession_percent', 'away_possession_percent'), percent: true },
    { label: 'Metres made', get: field('home_meters', 'away_meters') },
    { label: 'Points per 22 entry', get: ppe },
    { label: 'Turnovers won', get: field('home_turnovers_won', 'away_turnovers_won') },
    { label: 'Turnovers conceded', get: field('home_turnovers_conceded', 'away_turnovers_conceded'), inverted: true },
    { label: 'Handling errors', get: field('home_handling_errors', 'away_handling_errors'), inverted: true },
  ],
};

/** Match analysis AxisKey → shared AXIS_INFO key (only set-piece
 *  differs in spelling between the two engines). */
const INFO_KEY: Record<AxisKey, string> = {
  attack: 'attack',
  defence: 'defence',
  setPiece: 'set-piece',
  discipline: 'discipline',
  kicking: 'kicking',
  territory: 'territory',
  possession: 'possession',
  turnovers: 'turnovers',
};

/** The four standard axis pairs, match-engine keys (camelCase, unlike
 *  the pre-match engine's kebab-case). Same titles app-wide. */
export const MATCH_AXIS_PAIRS: readonly {
  title: string;
  /** Axis keys feeding the back-face narrative; empty for pairs with
   *  no match-axis narrative (Aerial — About-only back). */
  keys: readonly AxisKey[];
}[] = [
  { title: 'Attack & Defence', keys: ['attack', 'defence'] },
  { title: 'Set-Piece & Discipline', keys: ['setPiece', 'discipline'] },
  { title: 'Kicking & Territory', keys: ['kicking', 'territory'] },
  // Aerial rides behind Kicking & Territory (pre-match order); no
  // match axis narratives exist for it, so its back is About-only.
  { title: 'Aerial Contest', keys: [] },
  { title: 'Possession & Turnovers', keys: ['possession', 'turnovers'] },
];


// ─── Match Axis H2H (paired-section evidence) ───────────────────────────────

/**
 * Match Axis H2H — the fixture-scoped twin of the pre-match paired
 * axis cards: the pair's reads from THIS match, live-updating,
 * settled at full-time. Same anatomy, toggle, and tick meaning.
 */
export function MatchAxisH2H({
  pairTitle,
  axisKeys,
  fixture,
  homeCode,
  awayCode,
  read,
  style,
}: {
  pairTitle: string;
  axisKeys: readonly AxisKey[];
  fixture: Fixture;
  homeCode: string;
  awayCode: string;
  /** Live narrative for the flip back (pair opener + axis ¶s). */
  read?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = MATCH_PAIR_ROWS[pairTitle] ?? [];
  return (
    <MatchH2HCard
      title={pairTitle}
      fixture={fixture}
      homeCode={homeCode}
      awayCode={awayCode}
      rows={rows}
      read={read}
      purpose={PAIR_PURPOSES[pairTitle]?.match ?? "This match's numbers for the pair, live while the game runs, final at full-time."}
      style={style}
    />
  );
}

// ─── Shared card ────────────────────────────────────────────────────────────

function MatchH2HCard({
  title,
  fixture,
  homeCode,
  awayCode,
  rows,
  read,
  purpose,
  style,
}: {
  title: string;
  fixture: Fixture;
  homeCode: string;
  awayCode: string;
  rows: readonly RowDef[];
  read?: string | null;
  purpose: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  // Sweep-in driver (shared arrival grammar); replays on toggle.
  const ink = useChartInk(activeSide);
  const result = useFixtureResult(fixture.id, fixture.status);

  const notStarted = fixture.status === 'scheduled';

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title}
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>{purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Three slots: title left, toggle centred, reader icon right. */}
      <View style={styles.headerRow}>
        <CardTitle
          title={title}
        />
        <CardHeaderActions
          onExplain={() => setInfoOpen(true)}
          accessibilityLabel={`Read the ${title} analysis`}
          toggle={
            <TeamToggle
              primaryLabel={homeCode}
              compareLabel={awayCode}
              activeSide={activeSide}
              onSelect={setActiveSide}
            />
          }
        />
      </View>

      {notStarted ? (
        <Text style={styles.empty}>Populates once the match is under way.</Text>
      ) : result.isLoading && !result.data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !result.data ? (
        <Text style={styles.empty}>No match data on file.</Text>
      ) : (
        <View style={styles.rowsStack}>
          {rows.map((row) => {
            const r = result.data!;
            const h = row.get(r, 'home');
            const a = row.get(r, 'away');
            const active = activeSide === 'primary' ? h : a;
            const other = activeSide === 'primary' ? a : h;
            const max = Math.max(active, other, 0.001);
            const barFrac = MAX_FILL * (active / max);
            const tickFrac = MAX_FILL * (other / max);
            const better = row.inverted ? active < other : active > other;
            const worse = row.inverted ? active > other : active < other;
            const fill = better ? AHEAD_COLOR : worse ? BEHIND_COLOR : EVEN_COLOR;
            return (
              <View key={row.label} style={styles.rowBlock}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <View style={styles.rowLine}>
                  <View style={styles.rowTrack}>
                    <Animated.View
                      style={[
                        styles.rowFill,
                        {
                          width: `${Math.max(barFrac, 0.01) * 100}%`,
                          backgroundColor: fill,
                          transformOrigin: 'left',
                          transform: [{ scaleX: ink }],
                        },
                      ]}
                    />
                    {/* Other side's value — the comparison tick. */}
                    <View style={[styles.rowOtherTick, { left: `${tickFrac * 100}%` }]} />
                  </View>
                  <View style={[styles.rowValueBox, better ? styles.rowValueBoxWin : null]}>
                    <Text style={[styles.rowValue, better ? styles.rowValueTextWin : null]}>
                      <CountUpValue value={fmt(active)} ink={ink} />
                      {row.percent ? (
                        <Text style={[styles.rowValueSuffix, better ? styles.rowValueTextWin : null]}>
                          %
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

        </View>
      }
    />
  );
}

function fmt(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${s}%` : s;
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only).
  cardFill: { flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    // Standard air below the title/icon row (16pt total with gap).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  rowsStack: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: Spacing.two,
  },
  rowBlock: { gap: 4 },
  rowLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Mini score tile in the fixed right rail — the quiet losing-score
  // pairing, matching the Efficiency KPIs card.
  rowValueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  rowValueTextWin: { color: Colors.light.textInverse },
  rowValue: {
    // Match-score face — condensed italic at the row-score size.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  rowValueSuffix: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  rowTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    overflow: 'visible',
    justifyContent: 'center',
  },
  rowFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  rowOtherTick: {
    position: 'absolute',
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: '#111827',
    marginLeft: -1,
  },
});
