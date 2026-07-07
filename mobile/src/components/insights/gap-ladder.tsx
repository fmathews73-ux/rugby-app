import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import type { SignedGapView } from '@/hooks/use-match-preview';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
import { FlipCard, NarrativeBack } from '@/components/narrative-flip-card';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate, type TeamAggregate } from '@/hooks/use-team-aggregate';

// Perspective colours — the app's outcome pair: ahead green, behind red.
const AHEAD_COLOR = '#059669';
const BEHIND_COLOR = '#DC2626';
const EVEN_COLOR = Colors.light.textSecondary;

// Standard headroom rule: the longest bar tops out at 85% of the track.
const MAX_FILL = 0.85;

// App-wide analytical window (prev-10).
const LOOKBACK = 10;

type PerGame = TeamAggregate['perGame'];

/** One headline read per axis — the same metric the engine's gap
 *  calculation leans on. */
const AXIS_HEADLINE: Record<
  string,
  { label: string; get: (pg: PerGame) => number; percent?: boolean; inverted?: boolean }
> = {
  attack: { label: 'Points scored', get: (pg) => pg.pointsScored },
  defence: { label: 'Points conceded', get: (pg) => pg.pointsConceded, inverted: true },
  'set-piece': {
    label: 'Set-piece success',
    get: (pg) => (pg.scrumSuccessPercent + pg.lineoutSuccessPercent) / 2,
    percent: true,
  },
  discipline: { label: 'Penalties conceded', get: (pg) => pg.penaltiesConceded, inverted: true },
  kicking: { label: 'Kick metres', get: (pg) => pg.kickMeters },
  territory: { label: 'Territory', get: (pg) => pg.territoryPercent, percent: true },
  possession: { label: 'Possession', get: (pg) => pg.possessionPercent, percent: true },
  turnovers: { label: 'Turnovers won', get: (pg) => pg.turnoversWon },
};

/**
 * Profile H2H — the Shape section's evidence in the app's standard
 * bar-row grammar: one HEADLINE read per axis, ordered biggest gap
 * first (the engine's ranking), bar = the toggled team's number,
 * dark tick = the other side's number on the same scale — identical
 * anatomy and tick meaning as the axis H2H and KPI cards. Green =
 * toggled side better on the read (inverted-aware), red = worse.
 * (Two earlier forms — an SVG diverging ladder and threshold-unit
 * gap bars — were dropped: one-off chrome, and a tick glyph that
 * meant something different from every other card.)
 */
export function GapLadder({
  gaps,
  homeTeamId,
  awayTeamId,
  homeCode,
  awayCode,
  asOfDate,
  read,
  style,
}: {
  /** Engine gap ranking — used to ORDER the rows (biggest first). */
  gaps: readonly SignedGapView[];
  homeTeamId: string;
  awayTeamId: string;
  homeCode: string;
  awayCode: string;
  asOfDate?: string;
  /** Live narrative for the flip back (pre-match engine field). */
  read?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  const home = useTeamAggregate(homeTeamId, asOfDate, LOOKBACK);
  const away = useTeamAggregate(awayTeamId, asOfDate, LOOKBACK);
  const ready =
    (home.data?.gamesPlayed ?? 0) > 0 && (away.data?.gamesPlayed ?? 0) > 0;

  return (
    <FlipCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Profile H2H"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>The biggest statistical gaps between the two sides, ranked — the further a bar runs, the more one-sided that department has been over the last 10 matches.</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left; accessory then the reader icon pinned right —
          same corner slot as the Home carousel cards. */}
      {/* Three slots: title left, toggle centred between title and
          icon, reader icon pinned right. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Profile H2H</Text>
        <View style={styles.headerCentre}>
          <TeamToggle
            primaryLabel={homeCode}
            compareLabel={awayCode}
            activeSide={activeSide}
            onSelect={setActiveSide}
            />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the profile head-to-head chart">
          <Ionicons name="reader-outline" size={14} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      {home.isLoading || away.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : gaps.length === 0 || !ready ? (
        <Text style={styles.empty}>Not enough completed matches yet.</Text>
      ) : (
        <View style={styles.rowsStack}>
          {gaps.map((g) => {
            const headline = AXIS_HEADLINE[g.key];
            if (!headline) return null;
            const h = headline.get(home.data!.perGame);
            const a = headline.get(away.data!.perGame);
            const active = activeSide === 'primary' ? h : a;
            const other = activeSide === 'primary' ? a : h;
            const max = Math.max(active, other, 0.001);
            const barFrac = MAX_FILL * (active / max);
            const tickFrac = MAX_FILL * (other / max);
            const better = headline.inverted ? active < other : active > other;
            const worse = headline.inverted ? active > other : active < other;
            const fill = better ? AHEAD_COLOR : worse ? BEHIND_COLOR : EVEN_COLOR;
            return (
              <View key={g.key} style={styles.rowBlock}>
                <Text style={styles.rowLabel}>{headline.label}</Text>
                <View style={styles.rowLine}>
                  <View style={styles.rowTrack}>
                    <View
                      style={[
                        styles.rowFill,
                        { width: `${Math.max(barFrac, 0.01) * 100}%`, backgroundColor: fill },
                      ]}
                    />
                    {/* Other side's value — the comparison tick. */}
                    <View style={[styles.rowOtherTick, { left: `${tickFrac * 100}%` }]} />
                  </View>
                  <View style={[styles.rowValueBox, better ? styles.rowValueBoxWin : null]}>
                    <Text style={[styles.rowValue, better ? styles.rowValueTextWin : null]}>
                      {fmt(active, headline.percent)}
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
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCentre: {
    flex: 1,
    alignItems: 'center',
  },
  sectionLabel: {
    // Chart-card title rule — same as the Home carousel cards.
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
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
  // Bar and value share one line: track flexes, value sits in a fixed
  // right rail so every track ends at the same point.
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  // Matches the Efficiency KPIs value register (bold, secondary grey,
  // tabular) — the app-wide standard for bar-row values.
  // Mini score tile in the fixed right rail — the quiet losing-score
  // pairing, matching the Efficiency KPIs card.
  rowValueBox: {
    width: 52,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowValueBoxWin: { backgroundColor: Colors.light.textSecondary },
  rowValueTextWin: { color: Colors.light.textInverse },
  rowValue: {
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  // overflow visible so the threshold tick stands taller than the track.
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

function fmt(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${s}%` : s;
}
