import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { useLatestRanking } from '@/api/hooks';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useT1Momentum, type TeamMomentumSummary } from '@/hooks/use-t1-momentum';
import type { FormOutcome, FormPoint } from '@/lib/form-momentum';

const HORIZONTAL_MARGIN = 40;
const WIN_COLOR = '#059669';
const LOSS_COLOR = StatusColor.live;
const DRAW_COLOR = Colors.light.textSecondary;

/**
 * Grid of Tier-1 team tiles. Each tile: flag + short name + current WR rank
 * + mini momentum sparkline of the team's last 5 completed matches. Tap a
 * tile to drill into the full per-team Insights profile.
 */
export function TeamGrid() {
  const router = useRouter();
  const { data, isLoading } = useT1Momentum();
  const ranking = useLatestRanking();

  const rankByTeam = useMemo(() => {
    const m = new Map<string, { rank: number; movement: number }>();
    for (const row of ranking.data?.rows ?? []) {
      m.set(row.team_id, { rank: row.rank, movement: row.movement ?? 0 });
    }
    return m;
  }, [ranking.data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const ra = rankByTeam.get(a.teamId)?.rank ?? 99;
      const rb = rankByTeam.get(b.teamId)?.rank ?? 99;
      return ra - rb;
    });
  }, [data, rankByTeam]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Tier 1 Teams</Text>
        <Text style={styles.headerSubtitle}>Tap a team for the full profile</Text>
      </View>

      {isLoading && data.every((t) => !t.team) ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <View style={styles.grid}>
          {sorted.map((t) => (
            <TeamTile
              key={t.teamId}
              summary={t}
              rank={rankByTeam.get(t.teamId)?.rank}
              onPress={() => router.push(`/insights/${t.teamId}`)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TeamTile({
  summary,
  rank,
  onPress,
}: {
  summary: TeamMomentumSummary;
  rank: number | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={styles.tileHead}>
        <View style={styles.tileHeadLeft}>
          {summary.team ? (
            <TeamFlagBall2D flagCode={summary.team.flag_code} size={FlagSize.medium} />
          ) : null}
          <Text style={styles.tileName}>
            {summary.team?.short_name ?? summary.teamId.toUpperCase()}
          </Text>
        </View>
        {rank !== undefined ? (
          <View style={styles.rankPill}>
            <Text style={styles.rankPillText}>#{rank}</Text>
          </View>
        ) : null}
      </View>

      <MiniSparkline points={summary.points} />

      <View style={styles.tileFooter}>
        {summary.streak ? (
          <Text style={[styles.streakText, outcomeColor(summary.streak.letter)]}>
            {summary.streak.count}
            {summary.streak.letter}
          </Text>
        ) : (
          <Text style={styles.mutedFooter}>—</Text>
        )}
        <Text style={styles.momentumText}>
          <Ionicons
            name={summary.momentum > 0 ? 'arrow-up' : summary.momentum < 0 ? 'arrow-down' : 'remove'}
            size={12}
            color={momentumColor(summary.momentum)}
          />{' '}
          <Text style={{ color: momentumColor(summary.momentum) }}>
            {summary.momentum > 0 ? '+' : ''}
            {summary.momentum}
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}

function MiniSparkline({ points }: { points: readonly FormPoint[] }) {
  const width = 120;
  const height = 32;
  const padX = 4;
  const padY = 4;

  if (points.length === 0) {
    return (
      <View style={styles.miniSparklineEmpty}>
        <Text style={styles.mutedFooter}>No data</Text>
      </View>
    );
  }

  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));
  const svgPoints = points.map((p, i) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    const x = padX + t * (width - 2 * padX);
    const yNorm = (p.diff + maxAbs) / (2 * maxAbs);
    const y = height - padY - yNorm * (height - 2 * padY);
    return { x, y, outcome: p.outcome };
  });
  const zeroY = height / 2;
  const polyline = svgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Line
        x1={padX}
        y1={zeroY}
        x2={width - padX}
        y2={zeroY}
        stroke="#E5E7EB"
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
      {svgPoints.length > 1 ? (
        <Polyline
          points={polyline}
          stroke={Colors.light.text}
          strokeWidth={1.5}
          fill="none"
        />
      ) : null}
      {svgPoints.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.2} fill={pointColor(p.outcome)} />
      ))}
    </Svg>
  );
}

function pointColor(o: FormOutcome): string {
  return o === 'W' ? WIN_COLOR : o === 'L' ? LOSS_COLOR : DRAW_COLOR;
}
function outcomeColor(o: FormOutcome) {
  return { color: pointColor(o) };
}
function momentumColor(m: number): string {
  return m > 0 ? WIN_COLOR : m < 0 ? LOSS_COLOR : DRAW_COLOR;
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  header: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    gap: 2,
  },
  headerLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  empty: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  grid: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    // Two tiles per row with the flex gap accounted for.
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.two,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  tileName: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  rankPill: {
    backgroundColor: Colors.light.text,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankPillText: {
    color: Colors.light.textInverse,
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  miniSparklineEmpty: {
    height: 32,
    justifyContent: 'center',
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    fontVariant: ['tabular-nums'],
  },
  momentumText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  mutedFooter: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
});
