import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import { Easing, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useFixture, useTeam, useFixtureEvents } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { LegendChip } from '@/components/insights/legend-chip';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { teamDotColor } from '@/lib/team-colors';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { MARKER_ICON, MARKER_ICON_SIZE, buildScoringMarkers, placeScoringMarkers, type ScoringMarker } from '@/lib/scoring-markers';
import {
  fixtureHasMomentum,
  momentumTotalMinutes,
  momentumWindowMinutes,
  useMatchMomentumTimeline,
  type MomentumSample,
} from '@/hooks/use-match-momentum-timeline';
import { smoothLinePath } from '@/lib/smooth-path';

// Team colour tokens for the momentum mirror. Home = light blue family,
// Away = light purple family. The line uses the strong hue, the fill
// uses the light hue with a vertical fade toward the zero baseline.
const HOME_LINE = '#3B82F6';
const HOME_FILL = '#93C5FD';
const AWAY_LINE = '#8B5CF6';
const AWAY_FILL = '#C4B5FD';

/**
 * Momentum — mirrored area chart showing the rolling scoring density
 * for each side across the full 80-minute match. Home team's line lifts
 * above the zero baseline in light blue; away team's line drops below
 * in light purple. Vertical dashed lines mark KO / HT / FT.
 *
 * The metric per minute t is the sum of points scored in the trailing
 * `momentumWindowMinutes()` window — a stable "how much scoring is
 * happening now" read that responds to bursts without flapping on
 * single events. See `use-match-momentum-timeline.ts`.
 *
 * Match-scoped only. Scheduled fixtures render an empty state.
 */
export function CombinedPointsPattern({
  fixtureId,
  homeTeamId,
  awayTeamId,
  read,
  style,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Live narrative for the flip back (match engine field). */
  read?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const fixture = useFixture(fixtureId);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);
  // Squad identity colours (owner call 2026-07-09) — the guarded
  // jersey palette used app-wide; the old blue/purple stay as
  // fallbacks while teams load. FILL variants lighten via opacity.
  const homeColor = teamDotColor(homeTeamId) ?? HOME_LINE;
  const awayColor = teamDotColor(awayTeamId) ?? AWAY_LINE;
  const { samples, maxAbs, effectiveMinute, isLoading, hasData } =
    useMatchMomentumTimeline(fixtureId, homeTeamId, awayTeamId);
  // Scoring events off the same timeline feed — rendered as icon
  // markers on the curve (tries, conversions, penalty goals).
  const events = useFixtureEvents(fixtureId, fixture.data?.status);
  const scoringMarkers = useMemo(
    () => buildScoringMarkers(events.data ?? [], homeTeamId),
    [events.data, homeTeamId],
  );

  const homeShort = homeTeam.data?.short_name ?? homeTeamId.toUpperCase();
  const awayShort = awayTeam.data?.short_name ?? awayTeamId.toUpperCase();
  const canRender = fixtureHasMomentum(fixture.data?.status);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Momentum"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>Both sides' weighted attacking activity in THIS match as ONE net curve — above the line the home side has the game by the throat, below it the away side does.</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        {/* Chart-title rule: Momentum/Progression centre like the
            radar and 2x2 cards. */}
        <View style={styles.titleCentreFill} pointerEvents="none">
          <CardTitle title="Momentum" />
        </View>
        <View style={styles.headerRightGroup}>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the momentum chart">
            <FlipTrigger />
          </Pressable>
        </View>
      </View>

      {!canRender ? (
        <Text style={styles.empty}>Momentum populates once the match is under way.</Text>
      ) : isLoading && !hasData ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <MomentumMirror
          homeColor={homeColor}
          awayColor={awayColor}
          samples={samples}
          maxAbs={maxAbs}
          effectiveMinute={effectiveMinute}
          markers={scoringMarkers}
        />
      )}
      {/* Bottom-centred colour legend — same spot and dot grammar as
          the Profile radar's. */}
      {canRender ? (
        <View style={styles.legend}>
          <LegendChip label={homeShort} color={homeColor} />
          <LegendChip label={awayShort} color={awayColor} />
        </View>
      ) : null}

        </View>
      }
    />
  );
}

// ─── Chart ──────────────────────────────────────────────────────────────────

/**
 * Zero-sum momentum chart. A SINGLE signed curve — home minus away —
 * that swings above the baseline when home has the initiative and below
 * when away does. The curve never shows both teams simultaneously
 * dominant, which reflects how momentum actually works in a match.
 *
 * The curve is filled in two halves via SVG clip paths: the portion
 * above the baseline uses the home-blue gradient, the portion below
 * uses the away-purple gradient. Line strokes follow the same clip
 * treatment so colour cleanly hands off at every zero-crossing.
 *
 * Curve drawn only up to `effectiveMinute` — live matches leave the
 * post-live region of the canvas empty rather than stretching a stale
 * curve across it.
 */
function MomentumMirror({
  samples,
  maxAbs,
  effectiveMinute,
  markers,
  homeColor,
  awayColor,
}: {
  samples: readonly MomentumSample[];
  maxAbs: number;
  effectiveMinute: number;
  markers: readonly ScoringMarker[];
  homeColor: string;
  awayColor: string;
}) {
  // Measured canvas — geometry in real pixels (no viewBox stretching),
  // filling whatever height the carousel grants the card.
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  // 8pt horizontal padding matches the other insights charts (Preview
  // sparklines, Scoring Progression) so all match-scoped charts share
  // one plot-area rhythm.
  const padX = 8;
  // Top band: period labels (KO/HT/FT), then the SAME 14pt air the
  // bottom band has between icons and minute labels, then the home
  // marker strip — symmetric rhythm top and bottom.
  const padTop = 42;
  const padBottom = 44;
  const plotHeight = height - padTop - padBottom;
  const midY = padTop + plotHeight / 2;
  // 0.8 amplitude — peaks stop short of the marker bands instead of
  // slamming the plot edges (owner: curves were too tall).
  const halfChart = (plotHeight / 2) * 0.8;

  const total = momentumTotalMinutes();

  const xForMinute = (m: number) =>
    padX + (m / total) * (width - 2 * padX);

  // Scoring-event icon strips — home below the period labels, away
  // above the minute labels (shared lib handles same-minute sidesteps).
  const placed = placeScoringMarkers(
    markers,
    xForMinute,
    28,
    height - padBottom + 4,
    effectiveMinute,
  );

  const drawable = samples.filter((p) => p.minute <= effectiveMinute);

  // Single signed curve: y is above midY when net > 0 (home ahead),
  // below when net < 0 (away ahead).
  const svgPoints = drawable.map((p) => ({
    x: xForMinute(p.minute),
    y: midY - (p.net / maxAbs) * halfChart,
  }));

  const smoothPath = svgPoints.length >= 2 ? smoothLinePath(svgPoints).path : '';

  // Closed area path: trace the curve, drop back to the baseline at the
  // end, run along the baseline to the start, close. The resulting
  // shape covers the region between the curve and the baseline —
  // clip paths then split it into the "home" (above) and "away" (below)
  // halves at render time.
  const areaPath =
    svgPoints.length >= 2
      ? `${smoothPath} L ${svgPoints[svgPoints.length - 1]!.x.toFixed(1)} ${midY.toFixed(1)} L ${svgPoints[0]!.x.toFixed(1)} ${midY.toFixed(1)} Z`
      : '';

  // Primary milestones (KO, HT, FT) get a label along the top; the two
  // intermediate quarter markers (20', 60') are lighter dashed guides
  // without labels so the eye can pace the timeline without clutter.
  const primaryMilestones: readonly { minute: number; label: string }[] = [
    { minute: 0, label: 'KO' },
    { minute: 40, label: 'HT' },
    { minute: 80, label: 'FT' },
  ];
  const intermediateMilestones: readonly number[] = [20, 60];

  // Fade-in driver (shared arrival grammar) — the momentum curve and
  // its scoring markers fade over the static timeline frame.
  // Longer ease-in-out sweep for the timeline wipe.
  const ink = useChartInk(undefined, { duration: 2000, easing: Easing.inOut(Easing.ease) });

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

      {/* Intermediate quarter guides (20', 60') — lightest dash so they
          pace the timeline without competing with the primary
          KO / HT / FT verticals. */}
      {intermediateMilestones.map((m) => (
        <Line
          key={`imi-${m}`}
          x1={xForMinute(m)}
          y1={padTop}
          x2={xForMinute(m)}
          y2={height - padBottom}
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      ))}

      {/* Primary milestone verticals — KO, HT, FT. Slightly stronger
          than the intermediates and dashed so they read as structural
          anchors of the 80' timeline. */}
      {primaryMilestones.map((m) => (
        <Line
          key={`ms-${m.minute}`}
          x1={xForMinute(m.minute)}
          y1={padTop}
          x2={xForMinute(m.minute)}
          y2={height - padBottom}
          stroke="#E5E7EB"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}

      {/* Zero baseline — the mirror axis. Medium grey at 1px so it
          reads as a quiet structural reference the two coloured halves
          swing around, without competing for attention with the fills. */}
      <Line
        x1={padX}
        y1={midY}
        x2={width - padX}
        y2={midY}
        stroke="#9CA3AF"
        strokeWidth={1}
      />

      {/* Primary milestone labels along the top. */}
      {primaryMilestones.map((m) => (
        <SvgText
          key={`msl-${m.minute}`}
          x={xForMinute(m.minute)}
          y={12}
          fill={Colors.light.textSecondary}
          fontFamily="Barlow_500Medium"
          fontSize={9}
          textAnchor={
            m.minute === 0 ? 'start' : m.minute === total ? 'end' : 'middle'
          }>
          {m.label}
        </SvgText>
      ))}

      {/* Minute ticks along the bottom — 20-minute intervals to anchor
          the game flow without cluttering the axis. */}
      {[0, 20, 40, 60, 80].map((m) => (
        <SvgText
          key={`x-${m}`}
          x={xForMinute(m)}
          y={height - 6}
          fill={Colors.light.textSecondary}
          fontFamily="Barlow_500Medium"
          fontSize={9}
          textAnchor={m === 0 ? 'start' : m === total ? 'end' : 'middle'}>
          {`${m}'`}
        </SvgText>
      ))}
    </Svg>
          {/* Data layer — revealed left-to-right (kick-off → FT) by a
              sliding clip window: the outer view (overflow hidden)
              translates in from the left while the inner content
              counter-translates, so the curve and markers stay put and
              the visible window sweeps across the timeline. Pure
              native-driver transforms. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height,
              overflow: 'hidden',
              transform: [
                { translateX: ink.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) },
              ],
            }}>
            <Animated.View
              style={{
                width,
                height,
                transform: [
                  { translateX: ink.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) },
                ],
              }}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <Defs>
                <ClipPath id="momentum-clip-above-data">
                  <Rect x={0} y={padTop} width={width} height={midY - padTop} />
                </ClipPath>
                <ClipPath id="momentum-clip-below-data">
                  <Rect x={0} y={midY} width={width} height={height - padBottom - midY} />
                </ClipPath>
              </Defs>
              {areaPath ? (
                <Path
                  d={areaPath}
                  fill={homeColor}
                  fillOpacity={0.25}
                  stroke="none"
                  clipPath="url(#momentum-clip-above-data)"
                />
              ) : null}
              {areaPath ? (
                <Path
                  d={areaPath}
                  fill={awayColor}
                  fillOpacity={0.25}
                  stroke="none"
                  clipPath="url(#momentum-clip-below-data)"
                />
              ) : null}
            </Svg>
            {/* Scoring-event icon markers — home above the plot, away
                below. */}
            {placed.map((mk, i) => (
              <View key={i} style={{ position: 'absolute', left: mk.x, top: mk.y }} pointerEvents="none">
                <Ionicons
                  name={MARKER_ICON[mk.type]}
                  size={MARKER_ICON_SIZE}
                  color={mk.side === 'home' ? homeColor : awayColor}
                />
              </View>
            ))}
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

// ─── Info modal ─────────────────────────────────────────────────────────────

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
    position: 'relative',
    // Standard air below the title/icon row (16pt total with gap).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  titleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Legend styling matches the Scoring Progression card so the two
  // temporal cards on the Insights pane share one grammar.
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  // Fills the card height the carousel grants (tallest-sibling
  // normalisation); minHeight preserves the original canvas in
  // intrinsic-height contexts.
  chartFill: {
    flex: 1,
    minHeight: 200,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

});
