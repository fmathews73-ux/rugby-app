import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import type { SignedGapView } from '@/hooks/use-match-preview';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
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
  style,
}: {
  /** Engine gap ranking — used to ORDER the rows (biggest first). */
  gaps: readonly SignedGapView[];
  homeTeamId: string;
  awayTeamId: string;
  homeCode: string;
  awayCode: string;
  asOfDate?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  const home = useTeamAggregate(homeTeamId, asOfDate, LOOKBACK);
  const away = useTeamAggregate(awayTeamId, asOfDate, LOOKBACK);
  const ready =
    (home.data?.gamesPlayed ?? 0) > 0 && (away.data?.gamesPlayed ?? 0) > 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Profile H2H</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the profile head-to-head chart">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <TeamToggle
          primaryLabel={homeCode}
          compareLabel={awayCode}
          activeSide={activeSide}
          onSelect={setActiveSide}
        />
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
                  <Text style={styles.rowValue}>{fmt(active, headline.percent)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile H2H</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              One headline read per axis across both sides&apos; last 10 matches
              before kickoff, ordered with the biggest gap at the top — the same
              ranking the Shape and Keys sections are written from. The bar is
              the toggled team&apos;s number,{' '}
              <Text style={styles.modalStrong}>the dark tick is the other
              side&apos;s number on the same scale</Text> — the distance between
              bar end and tick is the gap.
            </Text>
            <Text style={styles.modalBody}>
              Green means the toggled side has the better of the read, red the
              worse (lower-is-better rows like penalties flip). The rows at the
              top are the battlegrounds the analysis names.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
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
  // Bar and value share one line: track flexes, value sits in a fixed
  // right rail so every track ends at the same point.
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
  // Matches the Efficiency KPIs value register (bold, secondary grey,
  // tabular) — the app-wide standard for bar-row values.
  rowValue: {
    width: 52,
    textAlign: 'right',
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  modalStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
});

function fmt(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${s}%` : s;
}
