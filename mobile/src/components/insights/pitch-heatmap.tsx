import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import type { Fixture, MatchEvent } from '@rugby-app/shared';

import { useFixtureEvents, useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

// Rugby playing field is 100m × 70m; using a 10:7 viewBox so measurements
// map linearly. Try lines sit on the left/right edges (x=0 and x=PITCH_W);
// touchlines on the top/bottom (y=0 and y=PITCH_H).
const PITCH_W = 500;
const PITCH_H = 350;

// Density grid — one column per 5m stripe of pitch length + one row per
// 5m stripe of width. Fine enough to trace the heat, coarse enough that
// gaussian smoothing produces visible contours instead of noise.
const GRID_COLS = 20;
const GRID_ROWS = 14;

const HEAT_COLOR = '#DC2626';

/**
 * Pitch heatmap card. Renders a top-down rugby field with a kernel-
 * smoothed density overlay of one team's positional events (carries +
 * scoring). Match-scoped: reads from this fixture's events only. Toggle
 * pill in the header switches between home and away.
 */
export function PitchHeatmap({
  fixtureId,
  homeTeamId,
  awayTeamId,
  fixtureStatus,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  fixtureStatus?: Fixture['status'];
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  useEffect(() => {
    setActiveSide('primary');
  }, [awayTeamId]);

  const events = useFixtureEvents(fixtureId, fixtureStatus);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  const activeTeamId = activeSide === 'primary' ? homeTeamId : awayTeamId;

  // Events that carry positional data and belong to the active team.
  const heatEvents = useMemo(() => {
    const src = events.data ?? [];
    return src.filter(
      (e) => e.team_id === activeTeamId && typeof e.x === 'number' && typeof e.y === 'number',
    );
  }, [events.data, activeTeamId]);

  const smoothed = useMemo(() => buildSmoothedGrid(heatEvents), [heatEvents]);
  const maxDensity = useMemo(() => {
    let m = 0;
    for (const row of smoothed) for (const v of row) if (v > m) m = v;
    return m;
  }, [smoothed]);

  const cellW = PITCH_W / GRID_COLS;
  const cellH = PITCH_H / GRID_ROWS;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Pitch Heatmap</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Pitch Heatmap">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <TeamToggle
          primaryLabel={homeTeam.data?.short_name ?? homeTeamId.toUpperCase()}
          compareLabel={awayTeam.data?.short_name ?? awayTeamId.toUpperCase()}
          activeSide={activeSide}
          onSelect={setActiveSide}
        />
      </View>

      {events.isLoading && heatEvents.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : heatEvents.length === 0 ? (
        <Text style={styles.empty}>No positional data yet.</Text>
      ) : (
        <Svg
          width="100%"
          height={PITCH_H * 0.55}
          viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
          preserveAspectRatio="xMidYMid meet">
          {/* Pitch canvas — subtle green wash. */}
          <Rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill="#F0F7EF" />

          {/* Heatmap cells first so the pitch markings sit on top and
              stay readable. */}
          {smoothed.flatMap((row, r) =>
            row.map((v, c) => {
              if (v <= 0.01) return null;
              const alpha = Math.min(0.75, (v / (maxDensity || 1)) * 0.75);
              return (
                <Rect
                  key={`h-${r}-${c}`}
                  x={c * cellW}
                  y={r * cellH}
                  width={cellW}
                  height={cellH}
                  fill={HEAT_COLOR}
                  opacity={alpha}
                />
              );
            }),
          )}

          {/* Pitch markings — outer border, try lines, halfway (dashed),
              two 22m lines. Kept subtle so the heat reads first. */}
          <Rect
            x={0}
            y={0}
            width={PITCH_W}
            height={PITCH_H}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={1}
          />
          {/* 22m lines (22% and 78% of pitch length). */}
          <Line
            x1={PITCH_W * 0.22}
            y1={0}
            x2={PITCH_W * 0.22}
            y2={PITCH_H}
            stroke="#94A3B8"
            strokeWidth={1}
          />
          <Line
            x1={PITCH_W * 0.78}
            y1={0}
            x2={PITCH_W * 0.78}
            y2={PITCH_H}
            stroke="#94A3B8"
            strokeWidth={1}
          />
          {/* Halfway line — dashed. */}
          <Line
            x1={PITCH_W * 0.5}
            y1={0}
            x2={PITCH_W * 0.5}
            y2={PITCH_H}
            stroke="#94A3B8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </Svg>
      )}

      {/* Direction annotation — the team's attacking direction. */}
      {heatEvents.length > 0 ? (
        <Text style={styles.directionMeta}>
          {activeSide === 'primary' ? 'Attacks →' : '← Attacks'}
        </Text>
      ) : null}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

/**
 * Bucket events into a coarse grid, then apply a small gaussian kernel
 * (1,2,1 / 2,4,2 / 1,2,1) so the raw counts become smooth "heat" patches
 * instead of pixel spikes. Runs on the JS thread once per data change —
 * cost is trivial for ~30-60 events.
 */
function buildSmoothedGrid(events: readonly MatchEvent[]): number[][] {
  const raw: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(0),
  );
  for (const e of events) {
    if (e.x == null || e.y == null) continue;
    const c = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(e.x * GRID_COLS)));
    const r = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(e.y * GRID_ROWS)));
    raw[r]![c]! += 1;
  }
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];
  const kernelSum = 16;
  const smoothed: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(0),
  );
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      let acc = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
          acc += (raw[rr]![cc]! * kernel[dr + 1]![dc + 1]!);
        }
      }
      smoothed[r]![c] = acc / kernelSum;
    }
  }
  return smoothed;
}

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pitch Heatmap</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Top-down view of the pitch showing where the selected team's
            positional events landed — carries and scoring events with
            recorded coordinates. Denser blue = more of that team's play
            happened there.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Home attacks left-to-right by convention, away right-to-left.
            Heat concentrated in the opposition 22 (near the far try line)
            signals a team that spent the match camped in attacking
            territory; heat clustered in the team's own half reads as
            defensive absorption. The two 22-metre lines and the halfway
            line are marked as reference stripes on the pitch.
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
  directionMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
    textAlign: 'center',
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
