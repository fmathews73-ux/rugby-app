import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
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
  const analysis = useTeamAnalysis(teamId);
  const scored = useTeamPointsPattern(teamId, 'scored', undefined, LOOKBACK);
  const conceded = useTeamPointsPattern(teamId, 'conceded', undefined, LOOKBACK);

  const hasData =
    (scored.data?.gamesUsed ?? 0) > 0 && (conceded.data?.gamesUsed ?? 0) > 0;

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Rhythm"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.rhythm}
          purpose={
            <>Average points scored (up) and conceded (down) in each quarter of the match — where the team's scoring lives, and where it leaks.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Rhythm</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the scoring rhythm chart">
          <FlipTrigger />
        </Pressable>
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

        </View>
      }
    />
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
  // Badge room above / below the extreme bars + quarter labels at the
  // bottom band.
  const padY = 22;
  const padBottom = 18;

  const maxAbs = Math.max(5, ...scored, ...conceded);
  const plotH = height - padBottom;
  const zeroY = plotH / 2;
  const halfBand = plotH / 2 - padY;

  // Same gridline system as Danger Windows — the two charts tell the
  // same per-quarter story, so they share one scale grammar.
  const gridStep = maxAbs <= 6 ? 2 : maxAbs <= 12 ? 5 : 10;
  const gridValues: number[] = [];
  for (let g = gridStep; g <= maxAbs; g += gridStep) gridValues.push(g, -g);

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

  // Grow-in driver (shared arrival grammar).
  // Grow-in driver (bars rise from the baseline together).
  const ink = useChartInk();

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
          {/* Dashed scale gridlines + flush-left numerals — shared
              grammar with Danger Windows. Drawn first so bars sit on
              top. */}
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
                  fontFamily="Barlow_500Medium"
                  fontSize={9}
                  textAnchor="start">
                  {g > 0 ? `+${g}` : String(g)}
                </SvgText>
              </G>
            );
          })}
          {/* Light hairlines between the four quarter slots. */}
          {[1, 2, 3].map((q) => {
            const x = padX + q * ((width - 2 * padX) / 4);
            return (
              <Line
                key={`sep${q}`}
                x1={x}
                y1={2}
                x2={x}
                y2={plotH}
                stroke="#E5E7EB"
                strokeWidth={1}
              />
            );
          })}
          {bars.map((b) => (
            <Rect key={`u${b.label}`} x={b.up.x} y={b.up.y} width={b.up.w} height={b.up.h} rx={2} fill="#E5E7EB" />
          ))}
          {bars.map((b) => (
            <Rect key={`d${b.label}`} x={b.down.x} y={b.down.y} width={b.down.w} height={b.down.h} rx={2} fill="#E5E7EB" />
          ))}
          {/* Value badges — scored above its bar, conceded below its
              bar; same quiet circular badge as the Form margin values. */}
          {bars.map((b) => (
            <G key={`ul${b.label}`}>
              <Circle cx={b.up.x + b.up.w / 2} cy={b.up.y - 11} r={9} fill="#F3F4F6" />
              <SvgText
                x={b.up.x + b.up.w / 2}
                y={b.up.y - 8}
                fill={Colors.light.textSecondary}
                fontFamily="BarlowCondensed_700Bold_Italic"
                fontSize={11}
                textAnchor="middle">
                <CountUpTSpan value={fmt(b.up.v)} ink={ink} />
              </SvgText>
            </G>
          ))}
          {bars.map((b) => (
            <G key={`dl${b.label}`}>
              <Circle cx={b.down.x + b.down.w / 2} cy={b.down.y + b.down.h + 11} r={9} fill="#F3F4F6" />
              <SvgText
                x={b.down.x + b.down.w / 2}
                y={b.down.y + b.down.h + 14}
                fill={Colors.light.textSecondary}
                fontFamily="BarlowCondensed_700Bold_Italic"
                fontSize={11}
                textAnchor="middle">
                <CountUpTSpan value={fmt(b.down.v)} ink={ink} />
              </SvgText>
            </G>
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
              fontFamily="Barlow_500Medium"
              fontSize={9}
              textAnchor="middle">
              {b.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
      {width > 0 && height > 0 ? (
        <>
          {/* Verdict-colour layer growing out of the baseline over the
              grey ghosts: scored up, conceded down — scaling about the
              shared zero line moves both directions at once; every bar
              rises together. Pure native-driver transforms. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: [
                { translateY: zeroY - height / 2 },
                { scaleY: ink.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
                { translateY: -(zeroY - height / 2) },
              ],
            }}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              {bars.map((b) => (
                <Rect key={`u${b.label}`} x={b.up.x} y={b.up.y} width={b.up.w} height={b.up.h} rx={2} fill={SCORED_COLOR} />
              ))}
              {bars.map((b) => (
                <Rect key={`d${b.label}`} x={b.down.x} y={b.down.y} width={b.down.w} height={b.down.h} rx={2} fill={CONCEDED_COLOR} />
              ))}
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only — natural height
  // stays content-driven).
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
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
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
});
