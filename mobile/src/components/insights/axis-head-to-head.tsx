import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import type { PreviewAxisKey } from '@/hooks/use-match-preview';
import { AXIS_INFO, type SectionInfo } from '@/lib/analysis-section-info';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
import { useTeamAggregate, type TeamAggregate } from '@/hooks/use-team-aggregate';

const LEADING_COLOR = '#059669';
const LAGGING_COLOR = '#DC2626';
const TIE_COLOR = Colors.light.textSecondary;

// App-wide analytical window (prev-10).
const LOOKBACK = 10;

type PerGame = TeamAggregate['perGame'];

/** The 2-4 per-game reads behind each preview axis — the numeric
 *  evidence for the axis narrative one pane below. */
const AXIS_ROWS: Record<
  PreviewAxisKey,
  readonly { field: keyof PerGame; label: string; percent?: boolean; inverted?: boolean }[]
> = {
  attack: [
    { field: 'pointsScored', label: 'Points scored' },
    { field: 'tries', label: 'Tries' },
    { field: 'metersMade', label: 'Metres made' },
    { field: 'lineBreaks', label: 'Line breaks' },
  ],
  defence: [
    { field: 'pointsConceded', label: 'Points conceded', inverted: true },
    { field: 'triesConceded', label: 'Tries conceded', inverted: true },
    { field: 'tackleSuccessPercent', label: 'Tackle success', percent: true },
  ],
  'set-piece': [
    { field: 'scrumSuccessPercent', label: 'Scrum success', percent: true },
    { field: 'lineoutSuccessPercent', label: 'Lineout success', percent: true },
  ],
  discipline: [
    { field: 'penaltiesConceded', label: 'Penalties conceded', inverted: true },
    { field: 'handlingErrors', label: 'Handling errors', inverted: true },
    { field: 'yellowCards', label: 'Yellow cards', inverted: true },
    { field: 'redCards', label: 'Red cards', inverted: true },
  ],
  kicking: [
    { field: 'kicksInPlay', label: 'Kicks in play' },
    { field: 'kickMeters', label: 'Kick metres' },
    { field: 'goalKickingPercent', label: 'Goal kicking', percent: true },
  ],
  territory: [
    { field: 'territoryPercent', label: 'Territory', percent: true },
    { field: 'twentyTwoEntries', label: '22 entries' },
    { field: 'pointsPerTwentyTwoEntry', label: 'Points per 22 entry' },
  ],
  possession: [
    { field: 'possessionPercent', label: 'Possession', percent: true },
    { field: 'metersMade', label: 'Metres made' },
    // Converted possession — possession only matters against the
    // scoreboard, and PPE is that link (repeats on Kicking & Territory
    // by design: each card tells a complete story).
    { field: 'pointsPerTwentyTwoEntry', label: 'Points per 22 entry' },
  ],
  turnovers: [
    { field: 'turnoversWon', label: 'Turnovers won' },
    { field: 'turnoversConceded', label: 'Turnovers conceded', inverted: true },
    // The giveaway component of the ledger — how most possession dies.
    { field: 'handlingErrors', label: 'Handling errors', inverted: true },
  ],
};

/**
 * Axis head-to-head — one card per preview axis: the axis's per-game
 * reads for both sides across the prev-10 window, frozen as of
 * kickoff, in the fixture Stats bar grammar (centred label, flanking
 * values, diverging better/worse bars). The numeric evidence for the
 * axis narrative in the Pre-Match analysis card below.
 */
export function AxisHeadToHead({
  axisKeys,
  title,
  homeTeamId,
  awayTeamId,
  homeCode,
  awayCode,
  asOfDate,
  style,
}: {
  /** One or more preview axes — paired axes render as one dense card. */
  axisKeys: readonly PreviewAxisKey[];
  title: string;
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

  const info: SectionInfo = {
    title,
    paragraphs: axisKeys.flatMap((k) => AXIS_INFO[k]?.paragraphs ?? []),
  };
  // Concatenate the paired axes' rows, deduped by field (metres made
  // appears under both attack and possession).
  const seen = new Set<string>();
  const rows = axisKeys
    .flatMap((k) => AXIS_ROWS[k])
    .filter((r) => (seen.has(r.field) ? false : (seen.add(r.field), true)));
  const ready =
    (home.data?.gamesPlayed ?? 0) > 0 && (away.data?.gamesPlayed ?? 0) > 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>{title}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Explain ${info.title}`}>
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
      ) : !ready ? (
        <Text style={styles.empty}>Not enough completed matches yet.</Text>
      ) : (
        <View style={styles.rowsStack}>
          {rows.map((row) => {
            const h = home.data!.perGame[row.field];
            const a = away.data!.perGame[row.field];
            const active = activeSide === 'primary' ? h : a;
            const other = activeSide === 'primary' ? a : h;
            return (
              <PerspectiveRow
                key={row.field}
                label={row.label}
                active={active}
                other={other}
                percent={row.percent}
                inverted={row.inverted}
              />
            );
          })}
        </View>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{info.title}</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            {info.paragraphs.map((para, i) => (
              <Text key={i} style={styles.modalBody}>
                {para}
              </Text>
            ))}
            <Text style={styles.modalBody}>
              Values are per-game averages over each side&apos;s last {LOOKBACK}{' '}
              completed matches before kickoff. The bar is the toggled
              team&apos;s number — green when it has the better of the read,
              red when not (lower-is-better rows flip) — and the dark tick
              marks the other side&apos;s number on the same scale.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// The larger value tops out at this share of the track, so at least
// 15% grey headroom always remains and the tick for the other side
// never sits at the very edge.
const MAX_FILL = 0.85;

/** KPI-row grammar, head-to-head: the toggled side's bar on a full
 *  track, with a dark reference tick at the OTHER side's value on the
 *  same scale. Green = toggled side has the better of this read
 *  (inverted-aware), red = worse, grey = tie. */
function PerspectiveRow({
  label,
  active,
  other,
  percent,
  inverted,
}: {
  label: string;
  active: number;
  other: number;
  percent?: boolean;
  inverted?: boolean;
}) {
  const max = Math.max(active, other, 0.001);
  const barFrac = MAX_FILL * (active / max);
  const tickFrac = MAX_FILL * (other / max);
  const better = inverted ? active < other : active > other;
  const worse = inverted ? active > other : active < other;
  const fill = better ? LEADING_COLOR : worse ? LAGGING_COLOR : TIE_COLOR;

  return (
    <View style={styles.statBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowLine}>
        <View style={styles.rowTrack}>
          <View style={[styles.rowFill, { width: `${barFrac * 100}%`, backgroundColor: fill }]} />
          {/* Other side's value — the comparison tick. */}
          <View style={[styles.rowOtherTick, { left: `${tickFrac * 100}%` }]} />
        </View>
        <Text style={styles.rowValue}>{fmt(active, percent)}</Text>
      </View>
    </View>
  );
}

function fmt(v: number, percent?: boolean): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return percent ? `${s}%` : s;
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
  statBlock: { gap: 4 },
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
  // overflow visible so the comparison tick can stand taller than the
  // 4pt track — it's a reference mark, not part of the fill.
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
});
