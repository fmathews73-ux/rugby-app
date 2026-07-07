import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamMatchSeries } from '@/hooks/use-team-match-series';

const LOOKBACK = 10;
// Same bands the team analysis narrative uses (spec §10.2): ≤9 per
// game is disciplined, ≥12 is a problem.
const PENS_LOW = 9;
const PENS_HIGH = 12;

const GOOD_COLOR = '#059669';
const BAD_COLOR = '#DC2626';
const MID_COLOR = '#9CA3AF';

/**
 * Discipline Trend — penalties conceded per match across the last-10
 * window, bars coloured against the same bands the analysis narrative
 * judges by (≤9 disciplined, ≥12 a problem), with both reference
 * lines drawn so the reader sees the bands, not just the bars.
 */
export function DisciplineTrend({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = useTeamMatchSeries(teamId, LOOKBACK);

  return (
    <View style={[styles.card, style]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Discipline Trend</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the discipline trend chart">
          <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      {isLoading && data.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : data.length === 0 ? (
        <Text style={styles.empty}>No completed matches yet.</Text>
      ) : (
        <TrendChart values={data.map((d) => d.penaltiesConceded)} />
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discipline Trend</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Penalties conceded in each of the last {LOOKBACK} matches, oldest (left)
              to most recent (right). The dashed lines mark the bands the analysis
              judges by: <Text style={styles.modalStrong}>9 or fewer a game is
              disciplined</Text>, <Text style={styles.modalStrong}>12 or more is a
              problem</Text> — bars colour green, grey, or red against those bands.
            </Text>
            <Text style={styles.modalBody}>
              Penalties are the cheapest points and territory a side can give away, so
              a rising trend here usually shows up on the scoreboard within a match or
              two.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TrendChart({ values }: { values: readonly number[] }) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padLeft = 18;
  const padRight = 8;
  // Room for the value badges above the tallest bar.
  const padTop = 22;
  const padBottom = 6;

  const maxVal = Math.max(PENS_HIGH + 2, ...values);
  const plotBottom = height - padBottom;
  const yOf = (v: number) => padTop + (1 - v / maxVal) * (plotBottom - padTop);

  const bars = useMemo(() => {
    const n = values.length;
    if (n === 0 || width === 0 || height === 0) return [];
    const slotW = (width - padLeft - padRight) / n;
    const barW = Math.min(14, Math.max(6, slotW * 0.55));
    return values.map((v, i) => {
      const x = padLeft + i * slotW + (slotW - barW) / 2;
      const y = yOf(v);
      return {
        x,
        y,
        w: barW,
        h: plotBottom - y,
        cx: x + barW / 2,
        v,
        fill: v >= PENS_HIGH ? BAD_COLOR : v <= PENS_LOW ? GOOD_COLOR : MID_COLOR,
      };
    });
  }, [values, width, height, maxVal]);

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
          {bars.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={b.fill} />
          ))}
          {/* Band reference lines + flush-left labels. */}
          <Line x1={padLeft} y1={yOf(PENS_LOW)} x2={width - padRight} y2={yOf(PENS_LOW)} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
          <Line x1={padLeft} y1={yOf(PENS_HIGH)} x2={width - padRight} y2={yOf(PENS_HIGH)} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
          <SvgText x={0} y={yOf(PENS_LOW) + 3} fill={Colors.light.textSecondary} fontFamily="Barlow_500Medium" fontSize={9} textAnchor="start">
            {PENS_LOW}
          </SvgText>
          <SvgText x={0} y={yOf(PENS_HIGH) + 3} fill={Colors.light.textSecondary} fontFamily="Barlow_500Medium" fontSize={9} textAnchor="start">
            {PENS_HIGH}
          </SvgText>
          {/* Value badges above each bar — same quiet circular badge
              as the Form / Scoring Rhythm values. */}
          {bars.map((b, i) => (
            <G key={`l${i}`}>
              <Circle cx={b.cx} cy={b.y - 11} r={8} fill="#F3F4F6" />
              <SvgText
                x={b.cx}
                y={b.y - 8}
                fill={Colors.light.textSecondary}
                fontFamily="Barlow_500Medium"
                fontSize={9}
                textAnchor="middle">
                {b.v}
              </SvgText>
            </G>
          ))}
        </Svg>
      ) : null}
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
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
    fontFamily: 'Barlow_700Bold',
    fontSize: TextSize.sm,
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
    minHeight: 130,
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
