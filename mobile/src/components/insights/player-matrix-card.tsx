import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { usePlayer, usePlayerPercentiles } from '@/api/hooks';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { MatrixChart, type MatrixPoint } from '@/components/insights/matrix-chart';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { PLAYER_LOOKBACK } from '@/lib/player-roles';
import { teamDotColor } from '@/lib/team-colors';
import { Colors, Spacing, TextSize } from '@/constants/theme';

/** One axis of a player matrix — either a raw per-game field or a
 *  ratio of two fields (metres per carry). */
type AxisSpec =
  | { field: string }
  | { ratio: [string, string] }
  | { sum: [string, string] };

function axisValue(rates: Record<string, number>, spec: AxisSpec): number {
  if ('field' in spec) return rates[spec.field] ?? 0;
  if ('sum' in spec) return (rates[spec.sum[0]] ?? 0) + (rates[spec.sum[1]] ?? 0);
  const num = rates[spec.ratio[0]] ?? 0;
  const den = rates[spec.ratio[1]] ?? 0;
  return den > 0 ? num / den : 0;
}

/**
 * Player strategy matrix (owner calls 2026-07-10): the TOP TEN
 * most-used players in the position group as grey dots (the full
 * ~160-player cloud was tried and read as noise) — per-GAME rates,
 * dot size = minutes played — with the subject in the squad colour
 * under his surname. Crosshairs at the plotted pool's medians;
 * quadrants in the broadcast lexicon. The tier matrices' grammar at
 * player scale: where the dots place a TEAM in its tier, these place
 * a PLAYER among the leaders of his position.
 */
export function PlayerMatrixCard({
  playerId,
  teamId,
  title,
  purpose,
  accessibilityLabel,
  xAxis,
  yAxis,
  yLowerIsBetter,
  quadrants,
  xCaption,
  yCaption,
  style,
}: {
  playerId: string;
  teamId: string;
  title: string;
  purpose: string;
  accessibilityLabel: string;
  xAxis: AxisSpec;
  /** Fed negated by default so higher-is-better plots upward; set
   *  yLowerIsBetter for giveaway metrics (fed raw — the matrix plots
   *  smaller y higher). */
  yAxis: AxisSpec;
  yLowerIsBetter?: boolean;
  quadrants: { tr: string; tl: string; br: string; bl: string };
  xCaption: string;
  yCaption: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const percentiles = usePlayerPercentiles(playerId, PLAYER_LOOKBACK);
  const player = usePlayer(playerId);

  const points: MatrixPoint[] = useMemo(() => {
    const fullPool = percentiles.data?.pool ?? [];
    if (fullPool.length === 0) return [];
    // The full position-group pool (~160) read as noise (owner call
    // 2026-07-10): plot the TOP TEN by minutes — the group's most-used
    // players, selection being the honest quality filter — plus the
    // subject if he sits outside that ten. Tier-matrix density.
    const top = [...fullPool].sort((a, b) => b.minutes - a.minutes).slice(0, 10);
    const pool = top.some((p) => p.player_id === playerId)
      ? top
      : [...top, ...fullPool.filter((p) => p.player_id === playerId)];
    const minutes = pool.map((p) => p.minutes);
    const minM = Math.min(...minutes);
    const maxM = Math.max(...minutes);
    const span = Math.max(maxM - minM, 1);
    return pool.map((p) => ({
      id: p.player_id,
      code: p.player_id === playerId ? playerSurname(player.data?.name) : '',
      x: axisValue(p.rates, xAxis),
      // Higher-is-better y feeds NEGATED (smaller plots higher);
      // giveaway metrics feed RAW so fewer plots higher.
      y: yLowerIsBetter ? axisValue(p.rates, yAxis) : -axisValue(p.rates, yAxis),
      weight: (p.minutes - minM) / span,
    }));
  }, [percentiles.data, playerId, player.data, xAxis, yAxis, yLowerIsBetter]);

  const ready = points.length >= 4 && (percentiles.data?.appearances ?? 0) > 0;

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title={title}
          onClose={() => setInfoOpen(false)}
          purpose={<>{purpose}</>}
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.headerRow}>
            {/* Radar/2x2 rule: title centred on the chart's vertical
                axis. */}
            <View style={styles.titleCentreFill} pointerEvents="none">
              <CardTitle title={title} />
            </View>
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}>
              <FlipTrigger />
            </Pressable>
          </View>

          {percentiles.isLoading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : !ready ? (
            <Text style={styles.empty}>Not enough appearances to place him yet.</Text>
          ) : (
            <MatrixChart
              points={points}
              subjectId={playerId}
              subjectColor={teamDotColor(teamId)}
              quadrants={quadrants}
              xCaption={xCaption}
              yCaption={yCaption}
              sizeLabel="MINUTES"
            />
          )}
        </View>
      }
    />
  );
}

function playerSurname(full?: string): string {
  if (!full) return '';
  const i = full.lastIndexOf(' ');
  return (i === -1 ? full : full.slice(i + 1)).toUpperCase();
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
    justifyContent: 'flex-end',
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
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
});
