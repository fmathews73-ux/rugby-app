import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamMatchSeries } from '@/hooks/use-team-match-series';

const WIN_COLOR = '#059669';
const LOSS_COLOR = '#DC2626';
const DRAW_COLOR = '#9CA3AF';

const LOOKBACK = 10;

/**
 * Possession vs Outcome — one dot per match from the last-10 window:
 * x = possession share, y = points margin, coloured by result. The
 * crosshairs at 50% possession and zero margin cut the plot into four
 * readable quadrants, answering the question the aggregate cards
 * can't: does having the ball actually win this team games? Static,
 * measured-canvas geometry like every chart in the app.
 */
export function PossessionOutcome({
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
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Possession vs Outcome</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the possession versus outcome chart">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isLoading && data.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : data.length < 3 ? (
        <Text style={styles.empty}>Not enough completed matches yet.</Text>
      ) : (
        <ScatterChart points={data} />
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Possession vs Outcome</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              One dot per match across the last {LOOKBACK}: how much ball the team
              had (left to right) against the final margin (up for wins, down for
              losses). <Text style={styles.modalStrong}>Green won, red lost, grey
              drew.</Text>
            </Text>
            <Text style={styles.modalBody}>
              The crosshairs at 50% possession and zero margin make four quadrants.
              Top-right: dominated the ball and won. Top-left: won WITHOUT the ball
              (defence and counter-attack travel well). Bottom-right is the one
              analysts circle: plenty of possession, still lost — a side that keeps
              the ball without hurting anyone.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ScatterChart({
  points,
}: {
  points: readonly { possessionPercent: number; margin: number; outcome: string }[];
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padLeft = 18;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 18;

  // Symmetric domains around the crosshairs so 50% / zero always sit
  // centred: possession spread and margin spread padded a touch.
  const possSpread = Math.max(8, ...points.map((p) => Math.abs(p.possessionPercent - 50))) + 3;
  const marginSpread = Math.max(10, ...points.map((p) => Math.abs(p.margin))) + 3;

  const plotBottom = height - padBottom;
  const xOf = (poss: number) =>
    padLeft + ((poss - (50 - possSpread)) / (2 * possSpread)) * (width - padLeft - padRight);
  const yOf = (margin: number) =>
    padTop + ((marginSpread - margin) / (2 * marginSpread)) * (plotBottom - padTop);

  const midX = xOf(50);
  const midY = yOf(0);

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
          {/* Crosshairs — the 50% possession and zero-margin axes, in
              the shared matrix treatment. */}
          <Line x1={padLeft} y1={midY} x2={width - padRight} y2={midY} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
          <Line x1={midX} y1={padTop} x2={midX} y2={plotBottom} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />

          {/* Quadrant labels — whisper-grey, centred in each quadrant. */}
          <SvgText x={(midX + width - padRight) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            WON WITH BALL
          </SvgText>
          <SvgText x={(padLeft + midX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            WON WITHOUT
          </SvgText>
          <SvgText x={(midX + width - padRight) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            WASTED BALL
          </SvgText>
          <SvgText x={(padLeft + midX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            OUTPLAYED
          </SvgText>
          {/* Match dots. */}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={xOf(p.possessionPercent)}
              cy={yOf(p.margin)}
              r={3.5}
              fill={p.outcome === 'W' ? WIN_COLOR : p.outcome === 'L' ? LOSS_COLOR : DRAW_COLOR}
            />
          ))}
          {/* Y-axis caption — rotated, reading upward. */}
          <SvgText
            x={8}
            y={(padTop + plotBottom) / 2}
            fill={Colors.light.textSecondary}
            fontSize={8}
            fontWeight="700"
            letterSpacing={0.4}
            textAnchor="middle"
            transform={`rotate(-90, 8, ${(padTop + plotBottom) / 2})`}>
            POINTS MARGIN →
          </SvgText>
          {/* X-axis caption — matrix grammar (the vertical crosshair is
              the 50% possession line). */}
          <SvgText x={width / 2} y={height - 4} fill={Colors.light.textSecondary} fontSize={8} fontWeight="700" letterSpacing={0.4} textAnchor="middle">
            POSSESSION % →
          </SvgText>
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
    minHeight: 170,
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
