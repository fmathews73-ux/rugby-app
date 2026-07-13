import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import type { Fixture, Team } from '@rugby-app/shared';

import { useFixtureResult, useTeams } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { teamDotColor } from '@/lib/team-colors';
import { FlipTrigger } from '@/components/flip-trigger';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

// Same two-team palette as the Scoring Progression worms.
const HOME_COLOR = '#3B82F6';
const AWAY_COLOR = '#8B5CF6';

/**
 * Control vs Conversion — the match's head-to-head quadrant: each side
 * plotted by how much ball it had (x) against how many points it
 * scored (y), crosshairs at 50% possession and the match's points
 * midpoint. The quadrant a team lands in IS the match report:
 * dominant, clinical, sterile, or outclassed. Live fixtures update as
 * the score grows; scheduled fixtures show an empty state. Same
 * matrix chrome as the team 2x2s.
 */
export function ControlConversion({
  fixtureId,
  homeTeamId,
  awayTeamId,
  fixtureStatus,
  read,
  style,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  fixtureStatus: Fixture['status'];
  /** Live narrative for the flip back (match engine field). */
  read?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const result = useFixtureResult(fixtureId, fixtureStatus);
  const teams = useTeams();

  const hasMatch =
    fixtureStatus === 'live' || fixtureStatus === 'half-time' || fixtureStatus === 'completed';
  const home = teams.data?.find((t) => t.id === homeTeamId);
  const away = teams.data?.find((t) => t.id === awayTeamId);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Verdict"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={<>Possession share set against the points it bought — did the side that had the ball actually bank it on the scoreboard? Crosshairs sit at 50% possession and the match's points midpoint.</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        {/* Radar/2x2 rule: title centred on the chart's vertical axis;
            bar-chart cards keep left titles. */}
        <View style={styles.titleCentreFill} pointerEvents="none">
          <CardTitle title="Verdict" />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the verdict chart">
          <FlipTrigger />
        </Pressable>
      </View>

      {!hasMatch ? (
        <Text style={styles.empty}>Populates once the match is under way.</Text>
      ) : result.isLoading && !result.data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !result.data || !home || !away ? (
        <Text style={styles.empty}>Match data not available yet.</Text>
      ) : (
        <QuadrantChart
          home={{
            team: home,
            possession: result.data.home_possession_percent,
            points: result.data.home_score,
          }}
          away={{
            team: away,
            possession: result.data.away_possession_percent,
            points: result.data.away_score,
          }}
        />
      )}

        </View>
      }
    />
  );
}

interface SidePoint {
  team: Team;
  possession: number;
  points: number;
}

function QuadrantChart({ home, away }: { home: SidePoint; away: SidePoint }) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  // Fade-in driver (shared arrival grammar) — the two team dots fade
  // over the static crosshairs.
  const ink = useChartInk();
  const width = canvas.w;
  const height = canvas.h;
  const padX = 18;
  const padTop = 14;
  const padBottom = 18;

  // X: symmetric around the 50% crosshair. Y: spans the two scores with
  // headroom; the crosshair sits at the points midpoint so one side is
  // always above and one below (unless level).
  // Proportional 15% headroom on the real deviation (matrix
  // convention); absolute floors stay so two close dots don't zoom
  // into noise.
  const possDev = Math.max(Math.abs(home.possession - 50), Math.abs(away.possession - 50));
  const possSpread = Math.max(8, possDev * 1.15);
  const yMid = (home.points + away.points) / 2;
  const yDev = Math.max(Math.abs(home.points - yMid), Math.abs(away.points - yMid));
  const ySpread = Math.max(6, yDev * 1.15);

  const plotBottom = height - padBottom;
  const xOf = (poss: number) =>
    padX + ((poss - (50 - possSpread)) / (2 * possSpread)) * (width - 2 * padX);
  const yOf = (pts: number) =>
    padTop + ((yMid + ySpread - pts) / (2 * ySpread)) * (plotBottom - padTop);

  const midX = xOf(50);
  const midY = yOf(yMid);

  const dot = (side: SidePoint, color: string) => {
    const x = xOf(side.possession);
    const y = yOf(side.points);
    return (
      <>
        <Circle cx={x} cy={y} r={4.5} fill={color} />
        <SvgText
          x={x}
          y={y >= padTop + 18 ? y - 8 : y + 14}
          fill={Colors.light.text}
          fontFamily="BarlowCondensed_700Bold_Italic"
          fontSize={11}
          textAnchor="middle">
          {side.team.short_name}
        </SvgText>
      </>
    );
  };

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
          <Line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
          <Line x1={midX} y1={padTop} x2={midX} y2={plotBottom} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />

          {/* Quadrant labels — whisper-grey, centred in each quadrant. */}
          <SvgText x={(midX + width - padX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontFamily="WorkSans_500Medium" fontSize={9} textAnchor="middle">
            DOMINANT
          </SvgText>
          <SvgText x={(padX + midX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontFamily="WorkSans_500Medium" fontSize={9} textAnchor="middle">
            RUTHLESS
          </SvgText>
          <SvgText x={(midX + width - padX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontFamily="WorkSans_500Medium" fontSize={9} textAnchor="middle">
            STERILE
          </SvgText>
          <SvgText x={(padX + midX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontFamily="WorkSans_500Medium" fontSize={9} textAnchor="middle">
            OUTCLASSED
          </SvgText>

          <SvgText x={width / 2} y={height - 4} fill={Colors.light.textSecondary} fontFamily="WorkSans_500Medium" fontSize={9} letterSpacing={0.4} textAnchor="middle">
            POSSESSION % →
          </SvgText>
          {/* Y-axis caption — rotated, reading upward. */}
          <SvgText
            x={8}
            y={(padTop + plotBottom) / 2}
            fill={Colors.light.textSecondary}
            fontFamily="WorkSans_500Medium"
            fontSize={9}
            letterSpacing={0.4}
            textAnchor="middle"
            transform={`rotate(-90, 8, ${(padTop + plotBottom) / 2})`}>
            POINTS SCORED →
          </SvgText>
        </Svg>
      ) : null}
      {width > 0 && height > 0 ? (
        /* Dot layer fades in over the static frame. */
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, opacity: ink }}>
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Variance decomposition (owner experiment 2026-07-09,
                two-team 2x2s only): an L of hairlines between the two
                dots — the horizontal leg carries the x-axis variance,
                the vertical leg the y-axis variance, each labelled at
                its midpoint with Δ and the midpoint-relative % var. */}
            {(() => {
              const hx = xOf(home.possession);
              const hy = yOf(home.points);
              const ax2 = xOf(away.possession);
              const ay2 = yOf(away.points);
              // RAW deltas in axis units (owner call 2026-07-09) —
              // matches the scoreboard arithmetic, zero decoding. The
              // possession axis's unit already is %.
              const dx = Math.abs(home.possession - away.possession);
              const dy = Math.abs(home.points - away.points);
              // Labels sit ON their hairline: the line breaks around
              // the label with padding either side.
              const xLabel = `\u0394 ${Math.round(dx)}%`;
              const yLabel = `\u0394 ${Math.round(dy)}`;
              const xMid = (hx + ax2) / 2;
              const yMid = (hy + ay2) / 2;
              // ~4.5px per glyph at 8pt + 4px pad each side.
              const xGapHalf = (xLabel.length * 4.5) / 2 + 4;
              // Vertical line breaks by label HEIGHT, not width.
              const yGapHalf = 9;
              const xDir = ax2 >= hx ? 1 : -1;
              const yDir = ay2 >= hy ? 1 : -1;
              // Each leg wears the colour of the side that LEADS the
              // axis it measures (squad palette).
              const homeCol = teamDotColor(home.team.id) ?? HOME_COLOR;
              const awayCol = teamDotColor(away.team.id) ?? AWAY_COLOR;
              const xCol = home.possession >= away.possession ? homeCol : awayCol;
              const yCol = home.points >= away.points ? homeCol : awayCol;
              return (
                <>
                  <Line x1={hx} y1={hy} x2={xMid - xGapHalf * xDir} y2={hy} stroke={xCol} strokeWidth={0.8} strokeDasharray="0.1 3" strokeLinecap="round" />
                  <Line x1={xMid + xGapHalf * xDir} y1={hy} x2={ax2} y2={hy} stroke={xCol} strokeWidth={0.8} strokeDasharray="0.1 3" strokeLinecap="round" />
                  <Line x1={ax2} y1={hy} x2={ax2} y2={yMid - yGapHalf * yDir} stroke={yCol} strokeWidth={0.8} strokeDasharray="0.1 3" strokeLinecap="round" />
                  <Line x1={ax2} y1={yMid + yGapHalf * yDir} x2={ax2} y2={ay2} stroke={yCol} strokeWidth={0.8} strokeDasharray="0.1 3" strokeLinecap="round" />
                  <SvgText
                    x={xMid}
                    y={hy + 3}
                    fill={xCol}
                    fontFamily="WorkSans_500Medium"
                    fontSize={8}
                    letterSpacing={0.4}
                    textAnchor="middle">
                    {xLabel}
                  </SvgText>
                  <SvgText
                    x={ax2}
                    y={yMid + 3}
                    fill={yCol}
                    fontFamily="WorkSans_500Medium"
                    fontSize={8}
                    letterSpacing={0.4}
                    textAnchor="middle">
                    {yLabel}
                  </SvgText>
                </>
              );
            })()}
            {dot(home, teamDotColor(home.team.id) ?? HOME_COLOR)}
            {dot(away, teamDotColor(away.team.id) ?? AWAY_COLOR)}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
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
    position: 'relative',
    justifyContent: 'flex-end',
    // Standard air below the title/icon row (16pt total with gap).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
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
    minHeight: 190,
  },
});
