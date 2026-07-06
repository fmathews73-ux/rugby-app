import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { useRankingHistory, useTeam } from '@/api/hooks';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

// Rank-move dot colours — green when the month's rank improved, red
// when it slipped, neutral grey when it held. Same trio as the Form
// card's margin bars.
const BETTER_COLOR = '#059669';
const WORSE_COLOR = '#DC2626';
const HELD_COLOR = '#9CA3AF';

/**
 * 12-month rank dot-lattice of a team's World Rugby position — see
 * TrajectoryChart below for the chart grammar. Uses the
 * rankings-history endpoint (13 monthly snapshots, July prior year →
 * today).
 */
export function RankingTrajectory({
  teamId,
  compareTeamId,
  asOfDate,
  style,
  title,
  showCornerFlag = true,
}: {
  teamId: string;
  compareTeamId?: string | null;
  /** When set, drop every snapshot dated at or after this ISO date —
   *  freezes the trajectory to what the reader would have seen walking
   *  into a specific match. */
  asOfDate?: string;
  /** Optional card-root style override — the Home carousel passes
   *  `flex: 1` so sibling pages normalise to equal heights. */
  style?: StyleProp<ViewStyle>;
  /** Optional header label override (e.g. Home's "My Team ..." titles). */
  title?: string;
  /** Hide the corner flag — Home's my-team cards drop it since the
   *  whole stack is already scoped to the selected team. */
  showCornerFlag?: boolean;
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

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>{title ?? 'World Ranking'}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the World Ranking chart">
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
        ) : showCornerFlag && primaryTeam.data ? (
          <TeamFlagBall2D flagCode={primaryTeam.data.flag_code} size={FlagSize.xs} />
        ) : null}
      </View>

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

/**
 * Rank dot-lattice — a punch-card of the team's World Rugby position.
 * Rows are DISCRETE rank rungs scaled to the observed range (a side
 * that moved between #3 and #9 gets six rungs, so a one-place move is
 * a visible step, not a pixel). One dot per monthly snapshot, coloured
 * by that month's direction: green climbed, red slipped, grey held /
 * first snapshot. Faint labelled gridlines carry the exact rank read;
 * the header meta keeps the window summary (#from \u2192 #to \u25b2n).
 */
function TrajectoryChart({
  series,
}: {
  series: { date: string; rank: number; points: number }[];
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  // Rank labels sit flush at x=0 so the axis aligns with the card's
  // title / meta text column; gridlines start after the label band.
  const padLeft = 18;
  const padRight = 10;
  const padTop = 10;
  // Bottom band reserved for the first/last month labels.
  const padBottom = 18;

  // Discrete rung domain: the observed rank range, padded to at least
  // three rungs so a season spent on one rank still draws a lattice.
  const observedMin = Math.min(...series.map((s) => s.rank));
  const observedMax = Math.max(...series.map((s) => s.rank));
  const minRank = observedMax - observedMin < 2 ? Math.max(1, observedMin - 1) : observedMin;
  const maxRank = observedMax - observedMin < 2 ? minRank + 2 : observedMax;
  const rungs: number[] = [];
  for (let r = minRank; r <= maxRank; r++) rungs.push(r);

  const plotBottom = height - padBottom;
  // Dot columns are inset from the label band so the first dot never
  // crowds the rung labels on the left.
  const plotLeft = padLeft + 12;
  const plotRight = width - padRight - 4;
  const rankToY = (rank: number) =>
    padTop + ((rank - minRank) / (maxRank - minRank)) * (plotBottom - padTop - 8);
  const idxToX = (i: number) => {
    if (series.length === 1) return (plotLeft + plotRight) / 2;
    return plotLeft + (i / (series.length - 1)) * (plotRight - plotLeft);
  };

  // The ladder's ENDS are always labelled — best and worst rank in the
  // window — so the reader can compute the variance at a glance. World-
  // ranking landmarks (1 / 5 / 10) are added where they fall inside the
  // ladder, skipped when within 2 rungs of an end so labels never crowd
  // or duplicate.
  const labelled = new Set<number>([minRank, maxRank]);
  for (const landmark of [1, 5, 10]) {
    if (landmark - minRank >= 2 && maxRank - landmark >= 2) labelled.add(landmark);
  }

  const dots = series.map((s, i) => {
    const prev = i > 0 ? series[i - 1]! : null;
    const fill =
      prev === null || s.rank === prev.rank
        ? HELD_COLOR
        : s.rank < prev.rank
          ? BETTER_COLOR
          : WORSE_COLOR;
    return { x: idxToX(i), y: rankToY(s.rank), fill };
  });

  const first = series[0];
  const last = series[series.length - 1];

  // Step-path connector — rank moves are discrete jumps, so the trace
  // runs flat then steps, never slopes. Drawn under the dots.
  const stepPath = dots
    .map((d, i) => (i === 0 ? `M ${d.x} ${d.y}` : `H ${d.x} V ${d.y}`))
    .join(' ');

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
      {/* Faint vertical month columns — completes the lattice grid so
          the canvas reads as a punch-card, not floating dots. */}
      {dots.map((d, i) => (
        <Line
          key={`v${i}`}
          x1={d.x}
          y1={padTop}
          x2={d.x}
          y2={plotBottom - 4}
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      ))}
      {/* Rung gridlines + rank labels. */}
      {rungs.map((r) => (
        <Line
          key={`g${r}`}
          x1={padLeft}
          y1={rankToY(r)}
          x2={width - padRight}
          y2={rankToY(r)}
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      ))}
      {rungs.map((r) =>
        labelled.has(r) ? (
          // Bare number, flush left with the card's text column — the
          // '#' prefix crowds double digits in SVG text; the header's
          // "#10 → #1" already frames these as ranks.
          <SvgText
            key={`t${r}`}
            x={0}
            y={rankToY(r) + 3}
            fill={Colors.light.textSecondary}
            fontSize={9}
            fontWeight="700"
            textAnchor="start">
            {r}
          </SvgText>
        ) : null,
      )}
      {/* Month-to-month step trace, under the dots — lighter than the
          standard chart line; the coloured dots carry the story. */}
      <Path d={stepPath} stroke="#9CA3AF" strokeWidth={1.2} fill="none" />
      {/* One dot per monthly snapshot, coloured by direction; the
          newest month is emphasised as the "you are here" marker. */}
      {dots.map((d, i) => (
        <Circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={i === dots.length - 1 ? 5 : 3.5}
          fill={d.fill}
          stroke={i === dots.length - 1 ? '#FFFFFF' : 'none'}
          strokeWidth={i === dots.length - 1 ? 1.5 : 0}
        />
      ))}
      {/* X-axis endpoints: month labels. */}
      {first ? (
        <SvgText
          x={plotLeft}
          y={height - 4}
          fill={Colors.light.textSecondary}
          fontSize={9}
          textAnchor="start">
          {formatMonth(first.date)}
        </SvgText>
      ) : null}
      {last ? (
        <SvgText
          x={plotRight}
          y={height - 4}
          fill={Colors.light.textSecondary}
          fontSize={9}
          textAnchor="end">
          {formatMonth(last.date)}
        </SvgText>
      ) : null}
      </Svg>
      ) : null}
    </View>
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
            <Text style={styles.modalTitle}>World Ranking (12 mo)</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            The team's official World Rugby rank across the last 12 monthly
            snapshots, oldest (left) to newest (right). Each dot sits on its
            rank rung — the ladder only spans the ranks the team actually
            touched, so even a one-place move is a visible step.{' '}
            <Text style={styles.modalStrong}>Green means the rank improved
            that month, red means it slipped, grey means it held.</Text> The
            grey step line traces the path between months, and the ringed
            dot marks the current position.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            The gridline numbers mark world-ranking landmarks (1, 5, 10)
            where they fall inside the ladder. World Rugby's algorithm is a
            rolling-weighted Elo variant, so movement is a function of
            recent results plus opponent strength — beating a higher-ranked
            side moves you further than beating a lower-ranked one.
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
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
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
    minHeight: 130,
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
