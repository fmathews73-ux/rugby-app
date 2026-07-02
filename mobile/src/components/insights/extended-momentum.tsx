import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import {
  formPointsFor,
  momentumFor,
  streakFor,
  type FormOutcome,
  type FormPoint,
} from '@/lib/form-momentum';

const HORIZONTAL_MARGIN = 40;
const LOOKBACK = 10;
const WIN_COLOR = '#059669';
const LOSS_COLOR = StatusColor.live;
const DRAW_COLOR = Colors.light.textSecondary;

/**
 * Extended Momentum sparkline — same weighted-momentum + streak treatment as
 * the Home My-Team card, but with a 10-match window and a larger canvas.
 * Note that the weighted-momentum score itself still uses the standard 5-match
 * weights (that's the "current momentum" reading) — the extra history is
 * shown for context so users can eyeball the longer-range trend.
 */
export function ExtendedMomentum({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const [infoOpen, setInfoOpen] = useState(false);

  const completedFixtures = useMemo(
    () => (team.data?.fixtures ?? []).filter((f) => f.status === 'completed'),
    [team.data],
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
    () => formPointsFor(teamId, completedFixtures, resultByFixture, LOOKBACK),
    [teamId, completedFixtures, resultByFixture],
  );
  const momentum = useMemo(
    () => momentumFor(teamId, completedFixtures, resultByFixture),
    [teamId, completedFixtures, resultByFixture],
  );
  const streak = useMemo(
    () => streakFor(teamId, completedFixtures, resultByFixture),
    [teamId, completedFixtures, resultByFixture],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Form (last {LOOKBACK})</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain extended momentum">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {streak && points.length > 0 ? (
          <View style={styles.headerMeta}>
            <Text style={[styles.streakText, { color: outcomeColor(streak.letter) }]}>
              {streak.count}
              {streak.letter}
            </Text>
            <Text style={styles.separator}> · </Text>
            <Text style={[styles.momentumText, { color: momentumColor(momentum) }]}>
              {momentum > 0 ? '+' : ''}
              {momentum}
              {momentum > 0 ? ' ▲' : momentum < 0 ? ' ▼' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {points.length === 0 ? (
        <Text style={styles.empty}>Not enough matches yet.</Text>
      ) : (
        <Sparkline points={points} />
      )}

      <MomentumInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        lookback={LOOKBACK}
      />
    </View>
  );
}

function Sparkline({ points }: { points: readonly FormPoint[] }) {
  const width = 280;
  const height = 90;
  const padX = 8;
  const padY = 12;
  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));

  const svgPoints = points.map((p, i) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    const x = padX + t * (width - 2 * padX);
    const yNorm = (p.diff + maxAbs) / (2 * maxAbs);
    const y = height - padY - yNorm * (height - 2 * padY);
    return { x, y, outcome: p.outcome, diff: p.diff };
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
        strokeDasharray="3 3"
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
        <Circle key={i} cx={p.x} cy={p.y} r={3.2} fill={outcomeColor(p.outcome)} />
      ))}
    </Svg>
  );
}

function outcomeColor(o: FormOutcome): string {
  return o === 'W' ? WIN_COLOR : o === 'L' ? LOSS_COLOR : DRAW_COLOR;
}
function momentumColor(m: number): string {
  return m > 0 ? WIN_COLOR : m < 0 ? LOSS_COLOR : DRAW_COLOR;
}

function MomentumInfoModal({
  visible,
  onClose,
  lookback,
}: {
  visible: boolean;
  onClose: () => void;
  lookback: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Form (last {lookback})</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Extended form chart showing this team's last {lookback} completed
            matches, oldest (left) to most recent (right). Each dot's height is
            the points-differential (final margin) for that game. Green = win,
            red = loss, grey = draw.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            The <Text style={styles.modalStrong}>streak</Text> in the header (e.g.
            2W) counts consecutive same-outcome matches from the most recent
            game backwards. The <Text style={styles.modalStrong}>momentum</Text>
            {' '}score (e.g. +18 ▲) is a recency-weighted sum of the last five
            point-differentials (1.0, 0.8, 0.6, 0.4, 0.2) — a scan-friendly
            "how are they trending right now" number.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: HORIZONTAL_MARGIN,
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
  streakText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    fontVariant: ['tabular-nums'],
  },
  separator: { fontSize: TextSize.sm, color: Colors.light.textSecondary },
  momentumText: {
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
