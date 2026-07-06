import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamPointsPattern } from '@/hooks/use-team-points-pattern';

// Same outcome trio as the Form margin bars.
const SCORED_COLOR = '#059669';
const CONCEDED_COLOR = '#DC2626';

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

// App-wide prev-10 analytical window.
const LOOKBACK = 10;

/**
 * Scoring Rhythm — the two Points Pattern reads combined into one
 * diverging chart: average points SCORED per 20-minute quarter rise
 * green above the baseline, average points CONCEDED fall red below.
 * When the team does its damage and when it gets hurt, in one glance.
 * Same diverging-bar grammar as the Form card; static fills; geometry
 * in real pixels from the measured canvas.
 */
export function ScoringRhythm({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const scored = useTeamPointsPattern(teamId, 'scored', undefined, LOOKBACK);
  const conceded = useTeamPointsPattern(teamId, 'conceded', undefined, LOOKBACK);

  const hasData =
    (scored.data?.gamesUsed ?? 0) > 0 && (conceded.data?.gamesUsed ?? 0) > 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Scoring Rhythm</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the scoring rhythm chart">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {scored.isLoading || conceded.isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !hasData ? (
        <Text style={styles.empty}>No completed matches yet.</Text>
      ) : (
        <RhythmChart
          scored={scored.data!.avgPointsByQuarter}
          conceded={conceded.data!.avgPointsByQuarter}
        />
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scoring Rhythm</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              The match split into its four 20-minute quarters, averaged across the
              team&apos;s last {LOOKBACK} completed matches (the same window as Form
              and the KPIs). <Text style={styles.modalStrong}>Green bars
              above the line are points scored</Text> in that quarter;{' '}
              <Text style={styles.modalStrong}>red bars below are points conceded</Text>.
              Taller bar = heavier scoring, and the number on each bar is the average.
            </Text>
            <Text style={styles.modalBody}>
              Read it for habits: a tall green Q4 is a side that finishes over the top
              of tiring defences; a deep red Q1 is a slow starter that spots opponents
              a head start.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RhythmChart({
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
  // Label room above / below the extreme bars + quarter labels at the
  // bottom band.
  const padY = 16;
  const padBottom = 18;

  const maxAbs = Math.max(5, ...scored, ...conceded);
  const plotH = height - padBottom;
  const zeroY = plotH / 2;
  const halfBand = plotH / 2 - padY;

  const bars = useMemo(() => {
    if (width === 0 || height === 0) return [];
    const slotW = (width - 2 * padX) / 4;
    const barW = Math.min(22, Math.max(10, slotW * 0.32));
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
