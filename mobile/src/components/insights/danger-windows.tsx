import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
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
  read,
  style,
}: {
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
  const activeTeamId = activeSide === 'primary' ? homeTeamId : awayTeamId;

  const scored = useTeamPointsPattern(activeTeamId, 'scored', asOfDate, LOOKBACK);
  const conceded = useTeamPointsPattern(activeTeamId, 'conceded', asOfDate, LOOKBACK);

  const ready =
    (scored.data?.gamesUsed ?? 0) > 0 && (conceded.data?.gamesUsed ?? 0) > 0;

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Danger"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>Each side's average points scored (up, green) and conceded (down, red) per 20-minute window — where one team's strong quarter lands on the other's weak one is where the match can swing.</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left; toggle then the reader icon pinned right —
          same corner slot as the Home carousel cards. */}
      {/* Three slots: title left, toggle centred between title and
          icon, reader icon pinned right. */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Danger</Text>
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
          accessibilityLabel="Explain the danger windows chart">
          <FlipTrigger />
        </Pressable>
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

        </View>
      }
    />
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
  // Badge room above / below the extreme bars.
  const padY = 22;
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

  // Grow-in driver (shared arrival grammar).
  // Grow-in driver (bars rise from the baseline together); replays on toggle.
  const ink = useChartInk(scored);

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
          {/* Light hairlines between the four quarter slots — shared
              grammar with Scoring Rhythm. */}
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
                  fontFamily="Barlow_500Medium"
                  fontSize={9}
                  textAnchor="start">
                  {g > 0 ? `+${g}` : String(g)}
                </SvgText>
              </G>
            );
          })}
          {bars.map((b) => (
            <Rect key={`u${b.label}`} x={b.up.x} y={b.up.y} width={b.up.w} height={b.up.h} rx={2} fill="#E5E7EB" />
          ))}
          {bars.map((b) => (
            <Rect key={`d${b.label}`} x={b.down.x} y={b.down.y} width={b.down.w} height={b.down.h} rx={2} fill="#E5E7EB" />
          ))}
          {/* Value badges — scored above its bar, conceded below its
              bar; same quiet circular badge as the Form / Scoring
              Rhythm values. */}
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
        /* Verdict-colour layer growing out of the baseline over the
           grey ghosts (Rhythm recipe); every bar rises together. Pure
           native-driver transforms. */
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
      ) : null}
    </View>
  );
}

function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
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
  chartFill: {
    flex: 1,
    minHeight: 150,
  },
});
