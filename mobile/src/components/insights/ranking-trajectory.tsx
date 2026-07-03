import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useRankingHistory, useTeam } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { CHART_LINE_COLOR, smoothLinePath } from '@/lib/smooth-path';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

const BETTER_COLOR = '#059669';
const WORSE_COLOR = StatusColor.live;

/**
 * 12-month line chart of a team's World Rugby ranking position. Y-axis is
 * inverted (rank 1 at the top) so "moving up the rankings" reads as the line
 * going up. Uses the rankings-history endpoint which now returns 13 monthly
 * snapshots (July prior year → today). Rank points are annotated at each
 * data point so the reader gets both the ordinal (rank) and the underlying
 * points behind it.
 */
export function RankingTrajectory({
  teamId,
  compareTeamId,
  asOfDate,
}: {
  teamId: string;
  compareTeamId?: string | null;
  /** When set, drop every snapshot dated at or after this ISO date —
   *  freezes the trajectory to what the reader would have seen walking
   *  into a specific match. */
  asOfDate?: string;
}) {
  const history = useRankingHistory();
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  // Reset toggle back to primary whenever the compare team changes.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');
  const hasCompare = Boolean(compareTeamId);
  const activeTeamId = activeSide === 'primary' ? teamId : (compareTeamId ?? teamId);

  const series = useMemo(() => {
    const points: { date: string; rank: number; points: number }[] = [];
    for (const snap of history.data ?? []) {
      // Freeze the series to snapshots dated strictly before `asOfDate`
      // when supplied — makes the trajectory a true pre-match view even
      // when the fixture is being reviewed years later.
      if (asOfDate && snap.snapshot_date >= asOfDate) continue;
      const row = snap.rows.find((r) => r.team_id === activeTeamId);
      if (!row) continue;
      points.push({ date: snap.snapshot_date, rank: row.rank, points: row.points });
    }
    // Ensure chronological order for the sparkline.
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }, [history.data, activeTeamId, asOfDate]);

  const summary = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    return {
      from: first.rank,
      to: last.rank,
      delta: first.rank - last.rank, // Positive = climbed (rank number went down)
      currentPoints: last.points,
    };
  }, [series]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Ranking Trajectory</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Ranking Trajectory">
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

      {/* Rank delta meta sits on its own row below the title — consistent
          placement with Form (streak/momentum), regardless of whether the
          toggle pill occupies the top-right slot. */}
      {summary ? (
        <View style={styles.subHeaderMeta}>
          <Text style={styles.headerMetaText}>
            #{summary.from} → #{summary.to}
          </Text>
          {summary.delta !== 0 ? (
            <Text
              style={[
                styles.headerMetaDelta,
                { color: summary.delta > 0 ? '#059669' : '#DC2626' },
              ]}>
              {'  '}
              {summary.delta > 0 ? '▲' : '▼'} {Math.abs(summary.delta)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {history.isLoading && series.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : series.length < 2 ? (
        <Text style={styles.empty}>Not enough history yet.</Text>
      ) : (
        <TrajectoryChart series={series} />
      )}

      <TrajectoryInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function TrajectoryChart({
  series,
}: {
  series: { date: string; rank: number; points: number }[];
}) {
  // Width matches the Form sparkline; height bumped so the y-axis has
  // enough vertical room per rank unit for the trajectory to read as a
  // meaningful line rather than a compressed wiggle.
  const width = 280;
  const height = 130;
  const padX = 8;
  const padTop = 10;
  const padBottom = 22;

  // Y-domain: rank 1 at top, worst-visible rank at bottom. Use max rank across
  // the series + 1 headroom, floored at 8 so a top-tier team's chart doesn't
  // collapse to a flat line.
  const maxRank = Math.max(8, ...series.map((s) => s.rank));
  const rankToY = (rank: number) => {
    const t = (rank - 1) / (maxRank - 1);
    return padTop + t * (height - padTop - padBottom);
  };
  const idxToX = (i: number) => {
    if (series.length === 1) return width / 2;
    return padX + (i / (series.length - 1)) * (width - 2 * padX);
  };

  const svgPoints = series.map((s, i) => ({
    x: idxToX(i),
    y: rankToY(s.rank),
    rank: s.rank,
    date: s.date,
  }));
  const smoothPath = smoothLinePath(svgPoints).path;

  // First + last data-point labels only — every-point labels get noisy on
  // a 13-point series inside a phone width.
  const first = svgPoints[0];
  const last = svgPoints[svgPoints.length - 1];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Trajectory line — Catmull-Rom → Bezier smoothed so segment
          junctions curve instead of cornering. */}
      <Path
        d={smoothPath}
        stroke={CHART_LINE_COLOR}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Data dots — coloured by rank change vs the PREVIOUS snapshot.
          Lower rank number = better, so an equal or improved rank reads
          as green; a worse (higher) rank reads as red. The first point
          has no predecessor and defaults to the "better" colour. */}
      {svgPoints.map((p, i) => {
        const prev = i > 0 ? svgPoints[i - 1]! : null;
        const isBetter = !prev || p.rank <= prev.rank;
        return (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.8}
            fill={isBetter ? BETTER_COLOR : WORSE_COLOR}
          />
        );
      })}
      {/* Rank annotations at each endpoint — same weight / fill / size so
          start and end read as one style, differing only in anchor. No
          '#' prefix: it visually clashes with the digits in SVG text and
          the chart context already reads as ranks. */}
      {first ? (
        <SvgText
          x={first.x}
          y={first.y - 6}
          fill={Colors.light.text}
          fontSize={10}
          fontWeight="700"
          textAnchor="start">
          {first.rank}
        </SvgText>
      ) : null}
      {last ? (
        <SvgText
          x={last.x}
          y={last.y - 6}
          fill={Colors.light.text}
          fontSize={10}
          fontWeight="700"
          textAnchor="end">
          {last.rank}
        </SvgText>
      ) : null}
      {/* X-axis endpoints: month labels. */}
      {first ? (
        <SvgText
          x={first.x}
          y={height - 4}
          fill={Colors.light.textSecondary}
          fontSize={9}
          textAnchor="start">
          {formatMonth(first.date)}
        </SvgText>
      ) : null}
      {last ? (
        <SvgText
          x={last.x}
          y={height - 4}
          fill={Colors.light.textSecondary}
          fontSize={9}
          textAnchor="end">
          {formatMonth(last.date)}
        </SvgText>
      ) : null}
    </Svg>
  );
}

function formatMonth(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function TrajectoryInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ranking Trajectory</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            The team's World Rugby ranking across the last 12 monthly snapshots,
            oldest (left) to newest (right). The y-axis is inverted so
            <Text style={styles.modalStrong}> rank 1 sits at the top</Text> —
            climbing the rankings visually pulls the line upward. World Rugby's
            algorithm is a rolling-weighted Elo variant, so movement is a
            function of recent results plus opponent strength.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            The header shows the start → end rank across the visible window and
            a total-climb indicator (▲ up, ▼ down).
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
  headerMeta: { flexDirection: 'row', alignItems: 'baseline' },
  subHeaderMeta: { flexDirection: 'row', alignItems: 'baseline' },
  headerMetaText: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  headerMetaDelta: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  // Modal
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
