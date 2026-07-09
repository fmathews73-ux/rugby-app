import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { useTeams } from '@/api/hooks';
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
  // Opponent flag per bar — the x-axis identifies who each match was
  // against.
  const allTeams = useTeams();
  const subjectTeam = (allTeams.data ?? []).find((t) => t.id === teamId);
  const flagByTeam = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTeams.data ?? []) m.set(t.id, t.flag_code);
    return m;
  }, [allTeams.data]);
  const analysis = useTeamAnalysis(teamId);
  const { data, isLoading } = useTeamMatchSeries(teamId, LOOKBACK);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Discipline"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.disciplineTrend}
          purpose={
            <>Penalties conceded match by match, banded at 9 (tidy) and 12 (trouble) — the read is the drift, not any single game.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        <CardTitle
          title="Discipline"
        />
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the discipline trend chart">
          <FlipTrigger />
        </Pressable>
      </View>

      {isLoading && data.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : data.length === 0 ? (
        <Text style={styles.empty}>No completed matches yet.</Text>
      ) : (
        <TrendChart
          values={data.map((d) => d.penaltiesConceded)}
          opponents={data.map((d) => d.opponentId)}
          flagByTeam={flagByTeam}
        />
      )}

        </View>
      }
    />
  );
}

function TrendChart({
  values,
  opponents,
  flagByTeam,
}: {
  values: readonly number[];
  opponents: readonly string[];
  flagByTeam: ReadonlyMap<string, string>;
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padLeft = 18;
  const padRight = 8;
  // Room for the value badges above the tallest bar.
  const padTop = 22;
  // Bottom axis band: 6pt air, 16pt opponent shield, 6pt air.
  const SHIELD = 16;
  const padBottom = SHIELD + 12;

  const maxVal = Math.max(PENS_HIGH + 2, ...values);
  // The team's own average across the window — the personal baseline
  // the 9/12 bands frame.
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
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

  // Grow-in driver (shared arrival grammar).
  // Grow-in driver (bars rise from the axis together).
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
        <>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {bars.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="#E5E7EB" />
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
          {/* The team's average — dotted, darker than the reference
              bands, labelled at the right edge. */}
          <Line
            x1={padLeft}
            y1={yOf(avg)}
            x2={width - padRight}
            y2={yOf(avg)}
            stroke={Colors.light.textSecondary}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <SvgText
            x={0}
            y={yOf(avg) - 4}
            fill={Colors.light.textSecondary}
            fontFamily="Barlow_500Medium"
            fontSize={9}
            textAnchor="start">
            avg
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
                fontFamily="BarlowCondensed_700Bold_Italic"
                fontSize={11}
                textAnchor="middle">
                <CountUpTSpan value={String(b.v)} ink={ink} />
              </SvgText>
            </G>
          ))}
        </Svg>
          {/* Verdict-colour layer growing up out of the axis over the
              grey ghosts; every bar rises together. Pure native-driver
              transforms. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: [
                { translateY: plotBottom - height / 2 },
                { scaleY: ink.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
                { translateY: -(plotBottom - height / 2) },
              ],
            }}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              {bars.map((b, i) => (
                <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={b.fill} />
              ))}
            </Svg>
          </Animated.View>
          {/* Opponent shields along the x-axis — 6pt air both sides
              inside the reserved bottom band. */}
          {bars.map((b, i) => {
            const flag = flagByTeam.get(opponents[i] ?? '');
            if (!flag) return null;
            return (
              <View
                key={`f${i}`}
                style={{ position: 'absolute', left: b.cx - SHIELD / 2, top: plotBottom + 6 }}
                pointerEvents="none">
                <TeamFlagShield flagCode={flag} width={SHIELD} />
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
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
    minHeight: 130,
  },
});
