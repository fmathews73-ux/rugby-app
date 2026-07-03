import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { CHART_LINE_COLOR, smoothLinePath } from '@/lib/smooth-path';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMatchPointsPattern } from '@/hooks/use-match-points-pattern';
import { useTeamPointsPattern } from '@/hooks/use-team-points-pattern';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

const SCORED_COLOR = '#059669';
const CONCEDED_COLOR = StatusColor.live;

/**
 * Combined Momentum — one chart with scoring bars above the x-axis
 * (green, positive %) and conceded bars below (red, negative %) for each
 * 20-minute block. Replaces the two separate scoring/concession cards
 * with a single symmetric read: net momentum per quarter at a glance.
 *
 * When `fixtureId` is supplied, both series are computed from just that
 * fixture's events. Otherwise, both are averaged across the team's
 * completed matches.
 */
export function CombinedPointsPattern({
  teamId,
  compareTeamId,
  fixtureId,
}: {
  teamId: string;
  compareTeamId?: string | null;
  fixtureId?: string;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  const isMatchMode = Boolean(fixtureId);

  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');

  // Both hooks always called (rules-of-hooks). Empty ids no-op safely so
  // only the active mode fetches real data.
  const primaryScoredAgg = useTeamPointsPattern(isMatchMode ? '' : teamId, 'scored');
  const primaryConcededAgg = useTeamPointsPattern(isMatchMode ? '' : teamId, 'conceded');
  const compareScoredAgg = useTeamPointsPattern(
    isMatchMode ? '' : (compareTeamId ?? ''),
    'scored',
  );
  const compareConcededAgg = useTeamPointsPattern(
    isMatchMode ? '' : (compareTeamId ?? ''),
    'conceded',
  );
  const primaryScoredMatch = useMatchPointsPattern(fixtureId ?? '', teamId, 'scored');
  const primaryConcededMatch = useMatchPointsPattern(fixtureId ?? '', teamId, 'conceded');
  const compareScoredMatch = useMatchPointsPattern(fixtureId ?? '', compareTeamId ?? '', 'scored');
  const compareConcededMatch = useMatchPointsPattern(
    fixtureId ?? '',
    compareTeamId ?? '',
    'conceded',
  );

  const scored = activeSide === 'primary'
    ? (isMatchMode ? primaryScoredMatch : primaryScoredAgg)
    : (isMatchMode ? compareScoredMatch : compareScoredAgg);
  const conceded = activeSide === 'primary'
    ? (isMatchMode ? primaryConcededMatch : primaryConcededAgg)
    : (isMatchMode ? compareConcededMatch : compareConcededAgg);

  const hasCompare = Boolean(compareTeamId);
  const scoredData = scored.data;
  const concededData = conceded.data;
  const isLoading = scored.isLoading || conceded.isLoading;
  const hasContent =
    (scoredData?.gamesUsed ?? 0) > 0 || (concededData?.gamesUsed ?? 0) > 0;

  // Use whichever series has a games count for the "avg across N" meta.
  const gamesUsed = scoredData?.gamesUsed ?? concededData?.gamesUsed ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Momentum</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Momentum">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {hasCompare ? (
          <TeamToggle
            primaryLabel={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
            compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
            activeSide={activeSide}
            onSelect={setActiveSide}
          />
        ) : null}
      </View>

      {!isMatchMode && gamesUsed > 0 ? (
        <Text style={styles.subHeaderMeta}>
          avg across {gamesUsed} game{gamesUsed === 1 ? '' : 's'}
        </Text>
      ) : null}

      {isLoading && !hasContent ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : hasContent ? (
        <MomentumArc
          scoredPercents={scoredData?.avgPercentByQuarter ?? [0, 0, 0, 0]}
          concededPercents={concededData?.avgPercentByQuarter ?? [0, 0, 0, 0]}
        />
      ) : (
        <Text style={styles.empty}>No scoring events yet to profile.</Text>
      )}

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        isMatchMode={isMatchMode}
      />
    </View>
  );
}

/**
 * Momentum arc — a single smoothed line showing net % (scored − conceded)
 * per quarter. Positive values (line above the dashed baseline) mean the
 * quarter was owned; negative values mean the opposition owned it. Each
 * quarter's data point is a coloured dot: green when positive, red when
 * negative, so the sign is readable even without axis labels.
 */
function MomentumArc({
  scoredPercents,
  concededPercents,
}: {
  scoredPercents: readonly [number, number, number, number];
  concededPercents: readonly [number, number, number, number];
}) {
  const width = 300;
  const height = 180;
  const padX = 24;
  const padTop = 18;
  const padBottom = 30;
  const midY = padTop + (height - padTop - padBottom) / 2;

  const nets = useMemo<[number, number, number, number]>(
    () => [
      scoredPercents[0] - concededPercents[0],
      scoredPercents[1] - concededPercents[1],
      scoredPercents[2] - concededPercents[2],
      scoredPercents[3] - concededPercents[3],
    ],
    [scoredPercents, concededPercents],
  );

  // Symmetric y-domain around 0 with a sensible floor so a flat series
  // still reads as a line rather than four dots on the baseline.
  const maxAbs = Math.max(20, ...nets.map((n) => Math.abs(n)));

  const svgPoints = nets.map((net, i) => {
    const t = i / 3;
    const x = padX + t * (width - 2 * padX);
    const halfChart = (height - padTop - padBottom) / 2;
    const y = midY - (net / maxAbs) * halfChart;
    return { x, y, net };
  });
  const smoothPath = smoothLinePath(svgPoints).path;

  const labels = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Zero baseline (dashed) — the "even quarter" reference. */}
      <Line
        x1={padX}
        y1={midY}
        x2={width - padX}
        y2={midY}
        stroke="#E5E7EB"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Momentum line — smooth curve through all four nets. */}
      <Path
        d={smoothPath}
        stroke={CHART_LINE_COLOR}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />

      {/* Per-quarter dots, coloured by sign of net. */}
      {svgPoints.map((p, i) => (
        <Circle
          key={`dot-${i}`}
          cx={p.x}
          cy={p.y}
          r={3.6}
          fill={p.net >= 0 ? SCORED_COLOR : CONCEDED_COLOR}
        />
      ))}

      {/* Net % label — sits above the dot when positive, below when
          negative, so it always stays clear of the line. */}
      {svgPoints.map((p, i) => {
        const above = p.net >= 0;
        const labelY = above ? p.y - 8 : p.y + 15;
        const sign = p.net > 0 ? '+' : '';
        return (
          <SvgText
            key={`nl-${i}`}
            x={p.x}
            y={labelY}
            fill={Colors.light.text}
            fontSize={11}
            fontWeight="700"
            textAnchor="middle">
            {`${sign}${Math.round(p.net)}%`}
          </SvgText>
        );
      })}

      {/* Q labels along the very bottom of the canvas. */}
      {labels.map((label, i) => {
        const t = i / 3;
        const cx = padX + t * (width - 2 * padX);
        return (
          <SvgText
            key={`x-${i}`}
            x={cx}
            y={height - 4}
            fill={Colors.light.textSecondary}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function InfoModal({
  visible,
  onClose,
  isMatchMode,
}: {
  visible: boolean;
  onClose: () => void;
  isMatchMode: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Momentum</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            One line telling the "who owned each quarter" story. For every
            20-minute block (Q1 0–20, Q2 20–40, Q3 40–60, Q4 60+), we take
            the team's <Text style={styles.modalStrong}>share of points scored</Text>
            {' '}and subtract their{' '}
            <Text style={styles.modalStrong}>share of points conceded</Text>{' '}
            to get a single "net momentum" percentage per quarter.
            {isMatchMode
              ? ' Values come from this fixture only.'
              : ' Values are averaged across the team’s completed matches.'}
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Above the dashed baseline (positive net, green dot) means the
            team owned that block. Below (negative net, red dot) means the
            opposition owned it. Q4 above the baseline is the classic
            "strong finisher" signal.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
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
  subHeaderMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
