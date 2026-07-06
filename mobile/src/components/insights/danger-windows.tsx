import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamPointsPattern } from '@/hooks/use-team-points-pattern';

// Same outcome pair as Scoring Rhythm / Form.
const SCORED_COLOR = '#059669';
const CONCEDED_COLOR = '#DC2626';

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const LOOKBACK = 10;

/**
 * Danger Windows — the Danger periods narrative's evidence, in the
 * Scoring Rhythm grammar: the TOGGLED side's average points SCORED
 * per 20-minute quarter rise green above the baseline, points
 * CONCEDED fall red below, across the prev-10 window frozen as of
 * kickoff. Flip the toggle to see the other side's rhythm — one
 * side's tall green quarter landing on the other's deep red quarter
 * is exactly the collision the prose names. Dashed gridlines carry
 * the scale (same treatment as the Form chart).
 */
export function DangerWindows({
  homeTeamId,
  awayTeamId,
  homeCode,
  awayCode,
  asOfDate,
  style,
}: {
  homeTeamId: string;
  awayTeamId: string;
  homeCode: string;
  awayCode: string;
  asOfDate?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  const activeTeamId = activeSide === 'primary' ? homeTeamId : awayTeamId;

  const scored = useTeamPointsPattern(activeTeamId, 'scored', asOfDate, LOOKBACK);
  const conceded = useTeamPointsPattern(activeTeamId, 'conceded', asOfDate, LOOKBACK);

  const ready =
    (scored.data?.gamesUsed ?? 0) > 0 && (conceded.data?.gamesUsed ?? 0) > 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Danger Windows</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the danger windows chart">
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

      {scored.isLoading || conceded.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !ready ? (
        <Text style={styles.empty}>Not enough completed matches yet.</Text>
      ) : (
        <WindowsChart
          scored={scored.data!.avgPointsByQuarter}
          conceded={conceded.data!.avgPointsByQuarter}
        />
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Danger Windows</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              The toggled team&apos;s match split into its four 20-minute
              quarters, averaged over its last {LOOKBACK} matches before
              kickoff. <Text style={styles.modalStrong}>Green above the line is
              points scored</Text> in that quarter,{' '}
              <Text style={styles.modalStrong}>red below is points
              conceded</Text>; the dashed gridlines carry the scale.
            </Text>
            <Text style={styles.modalBody}>
              Flip the toggle and look for collisions: one side&apos;s tall
              green quarter landing on the other&apos;s deep red quarter is the
              window the match can swing — exactly what the Danger periods
              narrative below names.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function WindowsChart({
  scored,
  conceded,
}: {
  scored: readonly [number, number, number, number];
  conceded: readonly [number, number, number, number];
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  const padY = 16;
  const padBottom = 18;

  const maxAbs = Math.max(5, ...scored, ...conceded);
  const plotH = height - padBottom;
  const zeroY = plotH / 2;
  const halfBand = plotH / 2 - padY;

  // Gridline step: a round number giving 1-2 rules per half.
  const gridStep = maxAbs <= 6 ? 2 : maxAbs <= 12 ? 5 : 10;
  const gridValues: number[] = [];
  for (let g = gridStep; g <= maxAbs; g += gridStep) gridValues.push(g, -g);

  const bars = useMemo(() => {
    if (width === 0 || height === 0) return [];
    const slotW = (width - 2 * padX) / 4;
    const barW = Math.min(26, Math.max(10, slotW * 0.32));
    return QUARTER_LABELS.map((label, q) => {
      const cx = padX + q * slotW + slotW / 2;
      const upH = (scored[q]! / maxAbs) * halfBand;
      const downH = (conceded[q]! / maxAbs) * halfBand;
      return {
        label,
        cx,
        up: { x: cx - barW - 1, y: zeroY - upH, w: barW, h: upH, v: scored[q]! },
        down: { x: cx + 1, y: zeroY, w: barW, h: downH, v: conceded[q]! },
      };
    });
  }, [width, height, scored, conceded, maxAbs, zeroY, halfBand]);

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
          {/* Scale gridlines — quiet dashed rules at ±step with bare
              flush-left numerals (same grammar as the Form chart),
              drawn first so bars sit on top. */}
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
          {bars.map((b) => (
            <Rect key={`u${b.label}`} x={b.up.x} y={b.up.y} width={b.up.w} height={b.up.h} rx={2} fill={SCORED_COLOR} />
          ))}
          {bars.map((b) => (
            <Rect key={`d${b.label}`} x={b.down.x} y={b.down.y} width={b.down.w} height={b.down.h} rx={2} fill={CONCEDED_COLOR} />
          ))}
          {/* Value labels — scored above its bar, conceded below its bar. */}
          {bars.map((b) => (
            <SvgText
              key={`ul${b.label}`}
              x={b.up.x + b.up.w / 2}
              y={b.up.y - 4}
              fill={Colors.light.textSecondary}
              fontSize={8}
              fontWeight="700"
              textAnchor="middle">
              {fmt(b.up.v)}
            </SvgText>
          ))}
          {bars.map((b) => (
            <SvgText
              key={`dl${b.label}`}
              x={b.down.x + b.down.w / 2}
              y={b.down.y + b.down.h + 11}
              fill={Colors.light.textSecondary}
              fontSize={8}
              fontWeight="700"
              textAnchor="middle">
              {fmt(b.down.v)}
            </SvgText>
          ))}
          {/* Baseline on top so the zero line stays crisp. */}
          <Line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#D1D5DB" strokeWidth={1.2} />
          {/* Quarter labels along the bottom band. */}
          {bars.map((b) => (
            <SvgText
              key={`q${b.label}`}
              x={b.cx}
              y={height - 4}
              fill={Colors.light.textSecondary}
              fontSize={9}
              textAnchor="middle">
              {b.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
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
  chartFill: {
    flex: 1,
    minHeight: 150,
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
