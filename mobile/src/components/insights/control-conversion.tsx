import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import type { Fixture, Team } from '@rugby-app/shared';

import { useFixtureResult, useTeams } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { AppLogo } from '@/components/app-logo';
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
          purpose={<>Territory and possession control set against points per 22 entry — did the side that ran the match actually bank it on the scoreboard?</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Verdict</Text>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Read the control versus conversion analysis">
          <AppLogo height={14} spin />
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
  const width = canvas.w;
  const height = canvas.h;
  const padX = 18;
  const padTop = 14;
  const padBottom = 18;

  // X: symmetric around the 50% crosshair. Y: spans the two scores with
  // headroom; the crosshair sits at the points midpoint so one side is
  // always above and one below (unless level).
  const possSpread = Math.max(8, Math.abs(home.possession - 50), Math.abs(away.possession - 50)) + 3;
  const yMid = (home.points + away.points) / 2;
  const ySpread = Math.max(6, Math.abs(home.points - yMid), Math.abs(away.points - yMid)) + 4;

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
          fontSize={9}
          fontWeight="700"
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
          <SvgText x={(midX + width - padX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            DOMINANT
          </SvgText>
          <SvgText x={(padX + midX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            CLINICAL
          </SvgText>
          <SvgText x={(midX + width - padX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            STERILE
          </SvgText>
          <SvgText x={(padX + midX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontSize={8} fontWeight="700" textAnchor="middle">
            OUTCLASSED
          </SvgText>

          {dot(home, HOME_COLOR)}
          {dot(away, AWAY_COLOR)}

          <SvgText x={width / 2} y={height - 4} fill={Colors.light.textSecondary} fontSize={8} fontWeight="700" letterSpacing={0.4} textAnchor="middle">
            POSSESSION % →
          </SvgText>
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
            POINTS SCORED →
          </SvgText>
        </Svg>
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
    // Standard air below the title/icon row (16pt total with gap).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
