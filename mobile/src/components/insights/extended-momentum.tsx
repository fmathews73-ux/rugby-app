import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { formPointsFor, type FormPoint } from '@/lib/form-momentum';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

// Outcome bar colours — same trio as FormCircles so W/L/D reads
// identically across the dot strip and the margin bars.
const WIN_COLOR = '#059669';
const LOSS_COLOR = '#DC2626';
const DRAW_COLOR = '#9CA3AF';

const LOOKBACK = 10;

/**
 * Extended Momentum sparkline — same weighted-momentum + streak treatment as
 * the Home My-Team card, but with a 10-match window and a larger canvas.
 * When a compare team is supplied, a two-segment toggle pill in the header
 * lets the user switch which team's sparkline is showing — one at a time,
 * matching the Team Profile radar's toggle pattern.
 */
export function ExtendedMomentum({
  teamId,
  compareTeamId,
  asOfDate,
  style,
  title,
  showCornerFlag = true,
}: {
  teamId: string;
  compareTeamId?: string | null;
  /** When set, drop every fixture with kickoff at or after this ISO
   *  timestamp — freezes the Form window to the state it held walking
   *  into a specific match. */
  asOfDate?: string;
  /** Optional card-root style override — the Home carousel passes
   *  `flex: 1` so sibling pages normalise to equal heights. */
  style?: StyleProp<ViewStyle>;
  /** Optional header label override (e.g. Home's "My Team ..." titles). */
  title?: string;
  /** Hide the corner flag — Home's my-team cards drop it since the
   *  whole stack is already scoped to the selected team. */
  showCornerFlag?: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  // Reset toggle back to the primary team whenever the compare team
  // changes or is cleared — avoids the pill sitting on a stale selection.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');

  const hasCompare = Boolean(compareTeamId);
  const activeTeamId = activeSide === 'primary' ? teamId : (compareTeamId ?? teamId);
  const activeTeam = activeSide === 'primary' ? primaryTeam : compareTeam;

  const completedFixtures = useMemo(
    () =>
      (activeTeam.data?.fixtures ?? []).filter(
        (f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate),
      ),
    [activeTeam.data, asOfDate],
  );

  // Only fetch results for the last-N fixtures we actually render.
  const lookback = useMemo(
    () =>
      [...completedFixtures]
        .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
        .slice(0, LOOKBACK),
    [completedFixtures],
  );

  const resultQueries = useQueries({
    queries: lookback.map((f) => ({
      queryKey: ['fixtureResult', f.id],
      queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
    })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) if (q.data) m.set(q.data.fixture_id, q.data);
    return m;
  }, [resultQueries]);

  const points = useMemo(
    () => formPointsFor(activeTeamId, completedFixtures, resultByFixture, LOOKBACK),
    [activeTeamId, completedFixtures, resultByFixture],
  );
  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>{title ?? 'Form'}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain extended momentum">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {hasCompare ? (
          <TeamToggle
            primaryLabel={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
            compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
            activeSide={activeSide}
            onSelect={setActiveSide}
          />
        ) : showCornerFlag && primaryTeam.data ? (
          // Single-team mode — anchor the header with the team's flag
          // so the card identifies its subject at a glance (Home's
          // my-team stack opts out; its scope is already explicit).
          <TeamFlagShield flagCode={primaryTeam.data.flag_code} width={FlagSize.xs} />
        ) : null}
      </View>

      {points.length === 0 ? (
        <Text style={styles.empty}>Not enough matches yet.</Text>
      ) : (
        <MarginBars points={points} />
      )}

      <MomentumInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        lookback={LOOKBACK}
      />
    </View>
  );
}

/**
 * Diverging margin bars — the broadcast-standard form read. One bar
 * per match off a shared zero baseline, oldest (left) to newest
 * (right): wins rise in green, losses drop in red, bar height scales
 * with the points margin, draws sit as small neutral stubs on the
 * baseline. Static fills (no motion, by rule); geometry computed in
 * real pixels from the onLayout-measured canvas.
 */
function MarginBars({ points }: { points: readonly FormPoint[] }) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  // Vertical padding reserves room for the margin value labels above
  // the tallest win bar and below the deepest loss bar.
  const padY = 16;
  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));
  const zeroY = height / 2;
  const halfBand = height / 2 - padY;

  // Gridline step: a round number giving 2-3 rules per half.
  const gridStep = maxAbs <= 12 ? 5 : maxAbs <= 30 ? 10 : 20;
  const gridValues: number[] = [];
  for (let g = gridStep; g <= maxAbs; g += gridStep) gridValues.push(g, -g);

  const bars = useMemo(() => {
    const n = points.length;
    if (n === 0 || width === 0 || height === 0) return [];
    const slotW = (width - 2 * padX) / n;
    // Fill the slot — thin bars in wide slots read as dead space.
    const barW = Math.min(26, Math.max(6, slotW * 0.62));
    return points.map((p, i) => {
      const x = padX + i * slotW + (slotW - barW) / 2;
      const cx = x + barW / 2;
      const barH = (Math.abs(p.diff) / maxAbs) * halfBand;
      if (p.diff === 0) {
        // Draw — a 2px neutral stub straddling the baseline, no label
        // (a zero margin is the absence of a story).
        return { x, y: zeroY - 1, w: barW, h: 2, fill: DRAW_COLOR, label: null, labelY: 0, cx };
      }
      const isWin = p.diff > 0;
      return {
        x,
        y: isWin ? zeroY - barH : zeroY,
        w: barW,
        h: barH,
        fill: isWin ? WIN_COLOR : LOSS_COLOR,
        // Margin value: above the bar for wins, below for losses.
        label: String(Math.abs(p.diff)),
        labelY: isWin ? zeroY - barH - 4 : zeroY + barH + 11,
        cx,
      };
    });
  }, [points, maxAbs, width, height, zeroY, halfBand]);

  return (
    <View
      style={styles.chartFill}
      onLayout={(e) =>
        setCanvas({
          w: Math.round(e.nativeEvent.layout.width),
          h: Math.round(e.nativeEvent.layout.height),
        })
      }>
      {width > 0 && height > 0 ? (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Margin gridlines — quiet dashed rules at ±step intervals
              with bare flush-left numerals, so the empty regions of the
              canvas still carry the scale (same grammar as the
              Discipline Trend bands / Ranking rungs). Drawn first so
              bars sit on top. */}
          {gridValues.map((g) => {
            const gy = zeroY - (g / maxAbs) * halfBand;
            return (
              <G key={`g${g}`}>
                <Line
                  x1={padX + 10}
                  y1={gy}
                  x2={width - padX}
                  y2={gy}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <SvgText
                  x={0}
                  y={gy + 3}
                  fill={Colors.light.textSecondary}
                  fontSize={8}
                  fontWeight="700"
                  textAnchor="start">
                  {g > 0 ? `+${g}` : String(g)}
                </SvgText>
              </G>
            );
          })}
          {bars.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={b.fill} />
          ))}
          {bars.map((b, i) =>
            b.label ? (
              <SvgText
                key={`l${i}`}
                x={b.cx}
                y={b.labelY}
                fill={Colors.light.textSecondary}
                fontSize={8}
                fontWeight="700"
                textAnchor="middle">
                {b.label}
              </SvgText>
            ) : null,
          )}
          {/* Baseline ON TOP of the bars so the zero line stays crisp
              where bars meet it. Solid and a step darker than the old
              dashed hairline — the axis is the anchor of the read. */}
          <Line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="#D1D5DB"
            strokeWidth={1.2}
          />
        </Svg>
      ) : null}
    </View>
  );
}



function MomentumInfoModal({
  visible,
  onClose,
  lookback,
}: {
  visible: boolean;
  onClose: () => void;
  lookback: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Form (prev. {lookback})</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            The selected team's last {lookback} completed matches, oldest
            (left) to most recent (right). Each bar rises or falls from the
            zero line by that game's points margin — green bars above the
            line are wins, red bars below are losses, and a small grey stub
            on the line is a draw. Taller bar = bigger margin; the number on
            each bar is the final margin itself.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
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
  // Chart fills whatever height the card grants it (Home carousel
  // stretches cards to the tallest sibling); minHeight preserves the
  // original canvas in intrinsic-height contexts.
  chartFill: {
    flex: 1,
    minHeight: 90,
  },

  // Modal
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
