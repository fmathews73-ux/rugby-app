import { useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useRankingHistory, useTeam } from '@/api/hooks';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, TextSize, TextTracking } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { fitNarrative } from '@/lib/fit-narrative';
import { formPointsFor } from '@/lib/form-momentum';

const LOOKBACK = 10;
const WIN_COLOR = '#059669';
const LOSS_COLOR = '#DC2626';

/**
 * Trajectory — the carousel's ONE time-series card (owner call
 * 2026-07-09): the matrices say where the side IS; this says where it
 * is HEADED. Two compact panels over the same left-to-right timeline:
 * world-rank steps on top, per-match points margins below. Reads on
 * the back combine the ranking and form narratives.
 */
export function TrajectoryCard({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
  const team = useTeam(teamId);

  // Rank series, oldest → newest.
  const history = useRankingHistory();
  const rankSeries = useMemo(() => {
    return (history.data ?? [])
      .slice()
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .map((snap) => snap.rows.find((r) => r.team_id === teamId)?.rank)
      .filter((r): r is number => r !== undefined);
  }, [history.data, teamId]);

  // Margin series, oldest → newest (same wiring as the retired Form
  // card; TanStack dedupes the result fetches with other consumers).
  const completedFixtures = useMemo(
    () => (team.data?.fixtures ?? []).filter((f) => f.status === 'completed'),
    [team.data],
  );
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
  const margins = useMemo(
    () => formPointsFor(teamId, completedFixtures, resultByFixture, LOOKBACK).map((p) => p.diff),
    [teamId, completedFixtures, resultByFixture],
  );

  const read = fitNarrative([analysis.data?.ranking, analysis.data?.form], 900);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Trajectory"
          flagCode={team.data?.flag_code}
          code={team.data?.short_name}
          comparison="LAST 10"
          onClose={() => setInfoOpen(false)}
          read={read}
          purpose={
            <>
              The direction of travel: world-rank steps above, per-match
              points margins below, oldest to newest over the same
              timeline. The matrices place the side; this card says
              whether it is climbing or sliding.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.headerRow}>
            <CardTitle
              title="Trajectory"
              flagCode={team.data?.flag_code}
              code={team.data?.short_name}
              comparison="LAST 10"
              centerTitle
            />
            <Pressable
              onPress={() => setInfoOpen(true)}
              style={styles.headerTrigger}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Read the trajectory analysis">
              <FlipTrigger />
            </Pressable>
          </View>

          {rankSeries.length < 2 && margins.length < 2 ? (
            <Text style={styles.empty}>Not enough completed matches yet.</Text>
          ) : (
            <View style={styles.panels}>
              <PanelLabel text="WORLD RANK" />
              <RankPanel series={rankSeries} />
              <PanelLabel text="MARGINS" />
              <MarginPanel margins={margins} />
            </View>
          )}
        </View>
      }
    />
  );
}

function PanelLabel({ text }: { text: string }) {
  return <Text style={styles.panelLabel}>{text}</Text>;
}

/** Timeline wipe wrapper shared by both panels (time-axis grammar). */
function useWipe() {
  return useChartInk(undefined, { duration: 2000, easing: Easing.inOut(Easing.ease) });
}

function RankPanel({ series }: { series: readonly number[] }) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const ink = useWipe();
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  const padY = 8;
  const minRank = Math.min(...series, 1);
  const maxRank = Math.max(...series, minRank + 1);
  const xOf = (i: number) =>
    padX + (series.length === 1 ? 0.5 : i / (series.length - 1)) * (width - 2 * padX);
  // Rank 1 plots at the top.
  const yOf = (rank: number) =>
    padY + ((rank - minRank) / (maxRank - minRank)) * (height - 2 * padY);
  const path = series
    .map((r, i) => (i === 0 ? `M ${xOf(i)} ${yOf(r)}` : `H ${xOf(i)} V ${yOf(r)}`))
    .join(' ');

  return (
    <View
      style={styles.panel}
      onLayout={(e) =>
        setCanvas({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })
      }>
      {width > 0 && height > 0 && series.length >= 2 ? (
        <>
          <View style={styles.rankEnds} pointerEvents="none">
            <Text style={styles.rankEndText}>#{series[0]}</Text>
            <Text style={styles.rankEndText}>#{series[series.length - 1]}</Text>
          </View>
          <Animated.View
            pointerEvents="none"
            style={{
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
                <Path d={path} stroke={Colors.light.textSecondary} strokeWidth={1.2} fill="none" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function MarginPanel({ margins }: { margins: readonly number[] }) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const ink = useWipe();
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  const maxAbs = Math.max(5, ...margins.map((m) => Math.abs(m)));
  const zeroY = height / 2;
  const half = height / 2 - 4;

  return (
    <View
      style={styles.panel}
      onLayout={(e) =>
        setCanvas({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })
      }>
      {width > 0 && height > 0 && margins.length >= 2 ? (
        <Animated.View
          pointerEvents="none"
          style={{
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
              <Line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#D1D5DB" strokeWidth={1} />
              {margins.map((m, i) => {
                const slotW = (width - 2 * padX) / margins.length;
                const barW = Math.min(10, Math.max(4, slotW * 0.5));
                const x = padX + i * slotW + (slotW - barW) / 2;
                const h = (Math.abs(m) / maxAbs) * half;
                return (
                  <Rect
                    key={i}
                    x={x}
                    y={m >= 0 ? zeroY - h : zeroY}
                    width={barW}
                    height={Math.max(h, m === 0 ? 1.5 : h)}
                    rx={1.5}
                    fill={m > 0 ? WIN_COLOR : m < 0 ? LOSS_COLOR : Colors.light.textSecondary}
                  />
                );
              })}
            </Svg>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTrigger: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  panels: { flex: 1, gap: Spacing.one },
  panel: { flex: 1, minHeight: 64 },
  panelLabel: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 9,
    letterSpacing: TextTracking.wide,
    textTransform: 'uppercase',
    color: Colors.light.textSecondary,
  },
  rankEnds: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  rankEndText: {
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
});
