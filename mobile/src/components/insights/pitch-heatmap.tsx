import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import type { Fixture, MatchEvent } from '@rugby-app/shared';

import { useFixtureEvents, useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

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

// Team-colour convention shared with the Momentum, Profile and Scoring
// Progression cards: home = blue family, away = purple family. Heat
// uses the FILL tokens (light shades) so overlap regions blend into a
// deeper contested colour rather than clashing at full saturation.
const HOME_HEAT = '#93C5FD';
const AWAY_HEAT = '#C4B5FD';

/**
 * Pitch heatmap card. Renders a top-down rugby field with kernel-smoothed
 * density overlays of both teams' positional events (carries + scoring)
 * on the same canvas. Home heat lifts in light blue, away heat lifts in
 * light purple; where both teams contested the same zone the two heats
 * naturally blend into a darker mixed colour.
 *
 * Match-scoped: reads from this fixture's events only. Both teams' heats
 * are normalised against a shared max so density scales stay directly
 * comparable.
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
  const events = useFixtureEvents(fixtureId, fixtureStatus);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  // Both teams' positional events extracted in one pass, split by side.
  const { homeEvents, awayEvents } = useMemo(() => {
    const src = events.data ?? [];
    const home: MatchEvent[] = [];
    const away: MatchEvent[] = [];
    for (const e of src) {
      if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
      if (e.team_id === homeTeamId) home.push(e);
      else if (e.team_id === awayTeamId) away.push(e);
    }
    return { homeEvents: home, awayEvents: away };
  }, [events.data, homeTeamId, awayTeamId]);

  const homeGrid = useMemo(() => buildSmoothedGrid(homeEvents), [homeEvents]);
  const awayGrid = useMemo(() => buildSmoothedGrid(awayEvents), [awayEvents]);

  // Single max across both grids so heat intensity reads consistently
  // between the two sides — a team with genuinely denser attacking play
  // shows genuinely brighter heat.
  const maxDensity = useMemo(() => {
    let m = 0;
    for (const row of homeGrid) for (const v of row) if (v > m) m = v;
    for (const row of awayGrid) for (const v of row) if (v > m) m = v;
    return m;
  }, [homeGrid, awayGrid]);

  const cellW = PITCH_W / GRID_COLS;
  const cellH = PITCH_H / GRID_ROWS;

  const homeShort = homeTeam.data?.short_name ?? homeTeamId.toUpperCase();
  const awayShort = awayTeam.data?.short_name ?? awayTeamId.toUpperCase();

  const isLoading = events.isLoading && homeEvents.length === 0 && awayEvents.length === 0;
  const hasData = homeEvents.length > 0 || awayEvents.length > 0;

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
        {/* Colour-swatch legend matches the Momentum / Progression /
            Profile cards. Both teams shown simultaneously so there's no
            toggle to drive. */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: HOME_HEAT }]} />
            <Text style={styles.legendText}>{homeShort}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: AWAY_HEAT }]} />
            <Text style={styles.legendText}>{awayShort}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !hasData ? (
        <Text style={styles.empty}>No positional data yet.</Text>
      ) : (
        <Svg
          width="100%"
          height={PITCH_H * 0.55}
          viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
          preserveAspectRatio="xMidYMid meet">
          {/* Neutral pitch canvas — matches the flat page-background
              tone used across the Insights tab rather than the
              broadcast-green wash. Heat colours pop cleanly against it. */}
          <Rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill="#FAFAFA" />

          {/* Home team heat — rendered first so away heat blends over
              the top of it. Overlap regions where both teams contested
              the same zone naturally mix into a deeper composite colour. */}
          {homeGrid.flatMap((row, r) =>
            row.map((v, c) => {
              if (v <= 0.01) return null;
              const alpha = Math.min(0.7, (v / (maxDensity || 1)) * 0.7);
              return (
                <Rect
                  key={`h-${r}-${c}`}
                  x={c * cellW}
                  y={r * cellH}
                  width={cellW}
                  height={cellH}
                  fill={HOME_HEAT}
                  opacity={alpha}
                />
              );
            }),
          )}

          {/* Away team heat overlaid on top of home. */}
          {awayGrid.flatMap((row, r) =>
            row.map((v, c) => {
              if (v <= 0.01) return null;
              const alpha = Math.min(0.7, (v / (maxDensity || 1)) * 0.7);
              return (
                <Rect
                  key={`a-${r}-${c}`}
                  x={c * cellW}
                  y={r * cellH}
                  width={cellW}
                  height={cellH}
                  fill={AWAY_HEAT}
                  opacity={alpha}
                />
              );
            }),
          )}

          {/* Pitch markings — outer border, 22m lines, halfway (dashed).
              Same medium grey used for structural axis lines on the
              Momentum / Progression charts so all Insights viz share
              one line-weight and colour system. */}
          <Rect
            x={0}
            y={0}
            width={PITCH_W}
            height={PITCH_H}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={1}
          />
          <Line
            x1={PITCH_W * 0.22}
            y1={0}
            x2={PITCH_W * 0.22}
            y2={PITCH_H}
            stroke="#9CA3AF"
            strokeWidth={1}
          />
          <Line
            x1={PITCH_W * 0.78}
            y1={0}
            x2={PITCH_W * 0.78}
            y2={PITCH_H}
            stroke="#9CA3AF"
            strokeWidth={1}
          />
          <Line
            x1={PITCH_W * 0.5}
            y1={0}
            x2={PITCH_W * 0.5}
            y2={PITCH_H}
            stroke="#9CA3AF"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </Svg>
      )}

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
            Top-down view of the pitch showing where each team's positional
            events landed (carries and scoring events with recorded
            coordinates). Home heat lifts in light blue, away heat lifts in
            light purple; where the two contested the same zone the
            colours blend into a deeper composite.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Home attacks left-to-right by convention, away right-to-left.
            Heat concentrated in a team's attacking 22 (the far try-line
            end) signals a match spent camped in opposition territory;
            heat clustered in the team's own half reads as defensive
            absorption. The two 22-metre lines and the halfway (dashed)
            are marked as reference stripes on the pitch.
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
  // Legend styling matches Momentum, Progression and Profile — one
  // grammar across every Insights card.
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 3,
    borderRadius: 1,
  },
  legendText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
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
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
