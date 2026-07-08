import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam, useTeams } from '@/api/hooks';
import { TeamFlagShield } from '@/components/team-flag-shield';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpTSpan } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
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
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
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
  // Opponent flag per bar — the x-axis identifies who each margin was
  // against.
  const allTeams = useTeams();
  const flagByTeam = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTeams.data ?? []) m.set(t.id, t.flag_code);
    return m;
  }, [allTeams.data]);
  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title ?? 'Form'}
          flagCode={activeTeam.data?.flag_code}
          code={activeTeam.data?.short_name}
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.form}
          purpose={
            <>Result margins from the team's recent matches — green bars above the line are wins, red below are losses; bar height is the size of the margin.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left; toggle/flag then the utility info icon pinned
          right on the same line (icon outermost — same corner slot as
          the Team Profile card). */}
      <View style={styles.headerRow}>
        <CardTitle
          title={title ?? 'Form'}
          flagCode={activeTeam.data?.flag_code}
          code={activeTeam.data?.short_name}
        />
        <View style={styles.headerRightGroup}>
          {hasCompare ? (
            <TeamToggle
              primaryLabel={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
              compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
              activeSide={activeSide}
              onSelect={setActiveSide}
            />
          ) : null}
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain extended momentum">
            <FlipTrigger />
          </Pressable>
        </View>
      </View>

      {points.length === 0 ? (
        <Text style={styles.empty}>Not enough matches yet.</Text>
      ) : (
        <MarginBars points={points} flagByTeam={flagByTeam} />
      )}
        </View>
      }
    />
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
function MarginBars({
  points,
  flagByTeam,
}: {
  points: readonly FormPoint[];
  flagByTeam: ReadonlyMap<string, string>;
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });

  // Grow-in driver (shared arrival grammar).
  // Grow-in driver (bars rise from the axis together); replays on toggle.
  const ink = useChartInk(points);
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  // Vertical padding reserves room for the margin value badges above
  // the tallest win bar and below the deepest loss bar. The opponent
  // shields sit ON the zero baseline in a central strip: equal air
  // above and below the shield before either side's bars begin.
  const padY = 20;
  const SHIELD = 16;
  const AXIS_HALF = SHIELD / 2 + 6; // shield half + equal padding each side
  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));
  const zeroY = height / 2;
  const halfBand = height / 2 - padY - AXIS_HALF;

  // Gridline step: a round number giving 2-3 rules per half.
  const gridStep = maxAbs <= 12 ? 5 : maxAbs <= 30 ? 10 : 20;
  const gridValues: number[] = [];
  for (let g = gridStep; g <= maxAbs; g += gridStep) gridValues.push(g, -g);

  const bars = useMemo(() => {
    const n = points.length;
    if (n === 0 || width === 0 || height === 0) return [];
    const slotW = (width - 2 * padX) / n;
    // Fill the slot — thin bars in wide slots read as dead space.
    // Bars match the opponent shields' width — bar and shield read as
    // one column per match.
    const barW = Math.min(SHIELD, slotW);
    return points.map((p, i) => {
      const x = padX + i * slotW + (slotW - barW) / 2;
      const cx = x + barW / 2;
      const barH = (Math.abs(p.diff) / maxAbs) * halfBand;
      if (p.diff === 0) {
        // Draw — a 2px neutral stub at the top edge of the axis strip,
        // no label (a zero margin is the absence of a story).
        return { x, y: zeroY - AXIS_HALF - 2, w: barW, h: 2, fill: DRAW_COLOR, label: null, labelY: 0, cx };
      }
      const isWin = p.diff > 0;
      return {
        x,
        y: isWin ? zeroY - AXIS_HALF - barH : zeroY + AXIS_HALF,
        w: barW,
        h: barH,
        fill: isWin ? WIN_COLOR : LOSS_COLOR,
        // Margin value badge: above the bar for wins, below for losses.
        label: String(Math.abs(p.diff)),
        labelY: isWin ? zeroY - AXIS_HALF - barH - 11 : zeroY + AXIS_HALF + barH + 11,
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
        <>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Margin gridlines — quiet dashed rules at ±step intervals
              with bare flush-left numerals, so the empty regions of the
              canvas still carry the scale (same grammar as the
              Discipline Trend bands / Ranking rungs). Drawn first so
              bars sit on top. */}
          {gridValues.map((g) => {
            const gy =
              g > 0
                ? zeroY - AXIS_HALF - (g / maxAbs) * halfBand
                : zeroY + AXIS_HALF + (-g / maxAbs) * halfBand;
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
          {bars.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="#E5E7EB" />
          ))}
          {bars.map((b, i) =>
            b.label ? (
              // Value badge — the quiet score-tile pairing (light fill,
              // grey digits) in circular form.
              <G key={`l${i}`}>
                <Circle cx={b.cx} cy={b.labelY} r={8} fill="#F3F4F6" />
                <SvgText
                  x={b.cx}
                  y={b.labelY + 3}
                  fill={Colors.light.textSecondary}
                  fontFamily="BarlowCondensed_700Bold_Italic"
                  fontSize={11}
                  textAnchor="middle">
                  <CountUpTSpan value={b.label ?? '0'} ink={ink} />
                </SvgText>
              </G>
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
          {/* Verdict-colour layers — identical bar geometry in the
              final W/L colours, growing out of the axis strip over the
              full-size grey ghosts; every bar rises together. Two
              layers so each side scaleY-anchors on its own baseline
              (translate-scale-translate recipe); pure native-driver
              transforms. */}
          {([
            { side: 'win', anchor: zeroY - AXIS_HALF },
            { side: 'loss', anchor: zeroY + AXIS_HALF },
          ] as const).map(({ side, anchor }) => (
            <Animated.View
              key={side}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: [
                  { translateY: anchor - height / 2 },
                  { scaleY: ink.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
                  { translateY: -(anchor - height / 2) },
                ],
              }}>
              <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {bars.map((b, i) => {
                  const isLossBar = points[i]?.diff != null && points[i].diff < 0;
                  if ((side === 'loss') !== isLossBar) return null;
                  return <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={b.fill} />;
                })}
              </Svg>
            </Animated.View>
          ))}
          {/* Opponent shields ON the zero baseline — who each margin
              was against, centred in the axis strip between the two
              half-charts. */}
          {bars.map((b, i) => {
            const flag = flagByTeam.get(points[i]?.opponentId ?? '');
            if (!flag) return null;
            return (
              <View
                key={`f${i}`}
                style={{ position: 'absolute', left: b.cx - SHIELD / 2, top: zeroY - SHIELD / 2 - 1 }}
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  // Chart fills whatever height the card grants it (Home carousel
  // stretches cards to the tallest sibling); minHeight preserves the
  // original canvas in intrinsic-height contexts.
  chartFill: {
    flex: 1,
    minHeight: 90,
  },

  // Modal
});
