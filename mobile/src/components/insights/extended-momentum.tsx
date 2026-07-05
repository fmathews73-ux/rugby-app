import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useTeam } from '@/api/hooks';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import {
  formPointsFor,
  momentumFor,
  streakFor,
  type FormPoint,
} from '@/lib/form-momentum';
import { CHART_ACCENT_COLOR, smoothLinePath } from '@/lib/smooth-path';
import { LineFadeRibbon } from '@/components/insights/line-fade-ribbon';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

const LOOKBACK = 10;

/**
 * Extended Momentum sparkline — same weighted-momentum + streak treatment as
 * the Home My-Team card, but with a 10-match window and a larger canvas.
 * When a compare team is supplied, a two-segment toggle pill in the header
 * lets the user switch which team's sparkline is showing — one at a time,
 * matching the Team Profile radar's toggle pattern.
 */
export function ExtendedMomentum({
  teamId,
  compareTeamId,
  asOfDate,
  style,
}: {
  teamId: string;
  compareTeamId?: string | null;
  /** When set, drop every fixture with kickoff at or after this ISO
   *  timestamp — freezes the Form window to the state it held walking
   *  into a specific match. */
  asOfDate?: string;
  /** Optional card-root style override — the Home carousel passes
   *  `flex: 1` so sibling pages normalise to equal heights. */
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  // Reset toggle back to the primary team whenever the compare team
  // changes or is cleared — avoids the pill sitting on a stale selection.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');

  const hasCompare = Boolean(compareTeamId);
  const activeTeamId = activeSide === 'primary' ? teamId : (compareTeamId ?? teamId);
  const activeTeam = activeSide === 'primary' ? primaryTeam : compareTeam;

  const completedFixtures = useMemo(
    () =>
      (activeTeam.data?.fixtures ?? []).filter(
        (f) => f.status === 'completed' && (!asOfDate || f.kickoff_utc < asOfDate),
      ),
    [activeTeam.data, asOfDate],
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
    () => formPointsFor(activeTeamId, completedFixtures, resultByFixture, LOOKBACK),
    [activeTeamId, completedFixtures, resultByFixture],
  );
  const momentum = useMemo(
    () => momentumFor(activeTeamId, completedFixtures, resultByFixture),
    [activeTeamId, completedFixtures, resultByFixture],
  );
  const streak = useMemo(
    () => streakFor(activeTeamId, completedFixtures, resultByFixture),
    [activeTeamId, completedFixtures, resultByFixture],
  );

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Form (prev. {LOOKBACK})</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain extended momentum">
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
        ) : primaryTeam.data ? (
          // Single-team mode (Home page) — anchor the header with the
          // team's flag on the right corner so the card identifies its
          // subject at a glance.
          <TeamFlagBall2D flagCode={primaryTeam.data.flag_code} size={FlagSize.xs} />
        ) : null}
      </View>

      {/* Streak + momentum meta always sits on its own row below the header
          title, whether or not the toggle pill is present. Keeps the meta
          in a consistent location and gives it visual breathing room from
          the title. */}
      {streak && points.length > 0 ? (
        <View style={styles.subHeaderMeta}>
          <Text style={styles.streakText}>
            {streak.count}
            {streak.letter}
          </Text>
          <Text style={styles.separator}> · </Text>
          <Text style={styles.momentumText}>
            {momentum > 0 ? '+' : ''}
            {momentum}
            {momentum > 0 ? ' ▲' : momentum < 0 ? ' ▼' : ''}
          </Text>
        </View>
      ) : null}

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
  // Real measured canvas — geometry is computed in actual pixels from
  // onLayout, never stretched via viewBox scaling, so strokes and dots
  // render true at any card height (the Home carousel stretches cards
  // to their tallest sibling; minHeight covers intrinsic contexts).
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  const padX = 8;
  const padY = 12;
  const maxAbs = Math.max(20, ...points.map((p) => Math.abs(p.diff)));

  const svgPoints = useMemo(
    () =>
      points.map((p, i) => {
        const t = points.length === 1 ? 0.5 : i / (points.length - 1);
        const x = padX + t * (width - 2 * padX);
        const yNorm = (p.diff + maxAbs) / (2 * maxAbs);
        const y = height - padY - yNorm * (height - 2 * padY);
        return { x, y, outcome: p.outcome, diff: p.diff };
      }),
    [points, maxAbs, width, height],
  );
  const zeroY = height / 2;

  // Smoothed Bézier path through the points — the curve stays static;
  // no motion graphics.
  const smoothPath = useMemo(() => smoothLinePath(svgPoints).path, [svgPoints]);

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
      <Defs>
        <ClipPath id="form-plot-clip">
          <Rect x={0} y={0} width={width} height={height - padY} />
        </ClipPath>
      </Defs>
      <Line
        x1={padX}
        y1={zeroY}
        x2={width - padX}
        y2={zeroY}
        stroke="#E5E7EB"
        strokeWidth={0.8}
        strokeDasharray="3 3"
      />
      {/* Contour-hugging fade — a short band directly beneath the line
          that follows its shape (GA-style), instead of an area fill
          reaching down to the axis. Clipped to the plot so the lowest
          echoes never spill past the bottom pad. Single accent blue for
          line, dots and fade — outcome colour lives in the streak /
          momentum meta above the chart, not on the line itself. */}
      {svgPoints.length > 1 ? (
        <G clipPath="url(#form-plot-clip)">
          <LineFadeRibbon path={smoothPath} stroke={CHART_ACCENT_COLOR} />
        </G>
      ) : null}
      {svgPoints.length > 1 ? (
        <Path
          d={smoothPath}
          stroke={CHART_ACCENT_COLOR}
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
      {svgPoints.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={1.5} fill={CHART_ACCENT_COLOR} />
      ))}
      </Svg>
      ) : null}
    </View>
  );
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
            <Text style={styles.modalTitle}>Form (prev. {lookback})</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Extended form chart showing the selected team's last {lookback}
            completed matches, oldest (left) to most recent (right). Each dot's
            height is the points-differential (final margin) for that game.
            Green = win, red = loss, grey = draw.
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
  headerMeta: { flexDirection: 'row', alignItems: 'baseline' },
  // Streak + momentum sits on its own row directly below the title, left-
  // aligned so it reads as an annotation of "Form (last 10)".
  subHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  streakText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  separator: { fontSize: TextSize.sm, color: Colors.light.textSecondary },
  momentumText: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
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
  // Chart fills whatever height the card grants it (Home carousel
  // stretches cards to the tallest sibling); minHeight preserves the
  // original canvas in intrinsic-height contexts.
  chartFill: {
    flex: 1,
    minHeight: 90,
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
