import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate, type TeamAggregate } from '@/hooks/use-team-aggregate';

const HORIZONTAL_MARGIN = 40;
const RADAR_COLOR = Colors.light.text;
const REFERENCE_COLOR = Colors.light.textSecondary;

/**
 * Six-axis Team Radar. Axes cover the classic rugby-analytics profile:
 * Attack, Defence, Set-piece, Discipline, Kicking, Territory.
 *
 * Each axis is normalised against a fixed rugby-realistic ceiling so the
 * polygon is directly interpretable in isolation (no "compared to what?"
 * ambiguity). A dashed hexagon at 50% radius reads as the "average" bench-
 * mark — a full-radius polygon means a top-tier profile, a shrunk polygon
 * flags weakness in that axis.
 *
 * `compareTeamId` (optional) overlays a second team's polygon as a dashed
 * grey outline for direct head-to-head reading. When set, the 50% reference
 * hexagon is hidden — two team polygons + a reference outline all at once
 * gets busy and the compare team already provides the "vs what?" anchor.
 */
export function TeamRadar({
  teamId,
  compareTeamId,
}: {
  teamId: string;
  compareTeamId?: string;
}) {
  const { data, isLoading } = useTeamAggregate(teamId);
  const compareAgg = useTeamAggregate(compareTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');
  const primaryTeam = useTeam(teamId);
  const [infoOpen, setInfoOpen] = useState(false);

  const axes = useMemo(() => buildAxes(data), [data]);
  const compareAxes = useMemo(
    () => (compareTeamId ? buildAxes(compareAgg.data) : null),
    [compareTeamId, compareAgg.data],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Team Profile</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Team Profile radar">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {data ? (
          <Text style={styles.headerMeta}>
            {data.gamesPlayed} game{data.gamesPlayed === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : data && data.gamesPlayed > 0 ? (
        <>
          <RadarChart axes={axes} compareAxes={compareAxes} />
          {compareAxes ? (
            <View style={styles.legendRow}>
              <LegendSwatch
                label={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
                variant="primary"
              />
              <LegendSwatch
                label={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
                variant="compare"
              />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>No completed matches to profile yet.</Text>
      )}

      <RadarInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function LegendSwatch({
  label,
  variant,
}: {
  label: string;
  variant: 'primary' | 'compare';
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          variant === 'primary'
            ? { backgroundColor: RADAR_COLOR }
            : {
                borderWidth: 1.5,
                borderColor: REFERENCE_COLOR,
                borderStyle: 'dashed',
                backgroundColor: 'transparent',
              },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

interface Axis {
  key: string;
  label: string;
  /** Team's value normalised to 0–1 (0 = worst, 1 = best/pool ceiling). */
  value: number;
  /** Raw scalar shown in the info modal / legend. */
  raw: string;
}

/**
 * Fixed normalisation ceilings — chosen from realistic Tier-1 international
 * ranges. A team hitting the ceiling on any axis is at the very top of the
 * international scale for that dimension.
 */
const AXIS_CEILINGS = {
  attack: 40,      // avg points scored per game
  defence: 40,     // avg points conceded per game (inverted)
  setPiece: 100,   // (scrum + lineout) success %
  discipline: 12,  // avg penalties conceded per game (inverted)
  kicking: 45,     // avg kick meters per kick in play
  territory: 60,   // avg territory %
};

function buildAxes(data: TeamAggregate | undefined): Axis[] {
  if (!data) {
    return [
      { key: 'attack', label: 'Attack', value: 0, raw: '—' },
      { key: 'defence', label: 'Defence', value: 0, raw: '—' },
      { key: 'setPiece', label: 'Set-piece', value: 0, raw: '—' },
      { key: 'discipline', label: 'Discipline', value: 0, raw: '—' },
      { key: 'kicking', label: 'Kicking', value: 0, raw: '—' },
      { key: 'territory', label: 'Territory', value: 0, raw: '—' },
    ];
  }
  const g = data.perGame;
  const setPiecePercent = (g.scrumSuccessPercent + g.lineoutSuccessPercent) / 2;
  const metersPerKick = g.kicksInPlay > 0 ? g.kickMeters / g.kicksInPlay : 0;

  return [
    {
      key: 'attack',
      label: 'Attack',
      value: clip01(g.pointsScored / AXIS_CEILINGS.attack),
      raw: `${g.pointsScored.toFixed(1)} pts/g`,
    },
    {
      key: 'defence',
      label: 'Defence',
      // Inverted — fewer points conceded = higher axis value.
      value: clip01(1 - g.pointsConceded / AXIS_CEILINGS.defence),
      raw: `${g.pointsConceded.toFixed(1)} pts conceded/g`,
    },
    {
      key: 'setPiece',
      label: 'Set-piece',
      value: clip01(setPiecePercent / AXIS_CEILINGS.setPiece),
      raw: `${setPiecePercent.toFixed(0)}% success`,
    },
    {
      key: 'discipline',
      label: 'Discipline',
      // Inverted — fewer penalties conceded = higher axis value.
      value: clip01(1 - g.penaltiesConceded / AXIS_CEILINGS.discipline),
      raw: `${g.penaltiesConceded.toFixed(1)} pens/g`,
    },
    {
      key: 'kicking',
      label: 'Kicking',
      value: clip01(metersPerKick / AXIS_CEILINGS.kicking),
      raw: `${metersPerKick.toFixed(0)} m/kick`,
    },
    {
      key: 'territory',
      label: 'Territory',
      value: clip01(g.territoryPercent / AXIS_CEILINGS.territory),
      raw: `${g.territoryPercent.toFixed(0)}% territory`,
    },
  ];
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function RadarChart({
  axes,
  compareAxes,
}: {
  axes: readonly Axis[];
  compareAxes?: readonly Axis[] | null;
}) {
  // Layout: 260×240 SVG viewBox with the hexagon centred. Label padding on
  // top/bottom pulled a bit tighter than sides so long axis labels don't
  // clip on narrow screens.
  const size = 260;
  const cx = size / 2;
  const cy = 120;
  const r = 82;

  // Angles: axis 0 sits at the top, walking clockwise.
  const angleFor = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
  const pointOn = (i: number, radius: number) => {
    const a = angleFor(i);
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  };

  // Team polygon vertices + reference (50%) hexagon vertices.
  const teamPoints = axes
    .map((ax, i) => pointOn(i, r * ax.value))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const referencePoints = axes
    .map((_, i) => pointOn(i, r * 0.5))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const comparePoints = compareAxes
    ? compareAxes
        .map((ax, i) => pointOn(i, r * ax.value))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ')
    : null;

  return (
    <Svg width="100%" height={240} viewBox={`0 0 ${size} 240`}>
      {/* Concentric rings at 25 / 50 / 75 / 100% radius. */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const pts = axes
          .map((_, i) => pointOn(i, r * frac))
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ');
        return (
          <Polygon
            key={frac}
            points={pts}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={0.8}
          />
        );
      })}
      {/* Axis spokes. */}
      {axes.map((_, i) => {
        const end = pointOn(i, r);
        return (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="#F3F4F6"
            strokeWidth={0.8}
          />
        );
      })}
      {/* Reference hexagon (50% = notional average). Hidden in compare mode:
          two polygons + a dashed reference is too busy, and the compare team
          already anchors "vs what?" for the reader. */}
      {!comparePoints ? (
        <Polygon
          points={referencePoints}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}
      {/* Compare polygon (rendered UNDER the primary polygon so the primary
          reads as the foreground). Dashed grey outline, no fill. */}
      {comparePoints ? (
        <Polygon
          points={comparePoints}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      ) : null}
      {/* Team polygon — solid fill at low opacity + stronger outline. */}
      <Polygon
        points={teamPoints}
        fill={RADAR_COLOR}
        fillOpacity={0.12}
        stroke={RADAR_COLOR}
        strokeWidth={1.5}
      />
      {/* Vertex dots — compare team's first (grey), then primary (dark) on top. */}
      {compareAxes?.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={`c${i}`} cx={p.x} cy={p.y} r={1.8} fill={REFERENCE_COLOR} />;
      })}
      {axes.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={i} cx={p.x} cy={p.y} r={2.2} fill={RADAR_COLOR} />;
      })}
      {/* Axis labels. */}
      {axes.map((ax, i) => {
        const labelP = pointOn(i, r + 16);
        return (
          <SvgText
            key={i}
            x={labelP.x}
            y={labelP.y + 3}
            fill={Colors.light.text}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle">
            {ax.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function RadarInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const axes = [
    { label: 'Attack', body: 'Average points scored per game.' },
    { label: 'Defence', body: 'Average points conceded per game (inverted — fewer is better).' },
    { label: 'Set-piece', body: 'Combined scrum + lineout success rate.' },
    { label: 'Discipline', body: 'Average penalties conceded per game (inverted — fewer is better).' },
    { label: 'Kicking', body: 'Average metres gained per kick in play.' },
    { label: 'Territory', body: 'Percentage of match time spent in the opposition half.' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Team Profile radar</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Six-axis profile across a rugby team's core dimensions. The dashed
            hexagon at 50% radius is the notional international average — a
            team polygon that extends beyond it on an axis reads as a strength;
            shrinking inside reads as a weakness.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            Use the <Text style={styles.modalStrong}>Compare vs…</Text> chip
            above the chart to overlay a second Tier-1 team as a dashed grey
            outline. Head-to-head reading: where the primary team's polygon
            extends past the compare polygon, that's a relative strength.
          </Text>
          <View style={styles.modalDivider} />
          {axes.map((a) => (
            <View key={a.label} style={styles.modalAxisRow}>
              <Text style={styles.modalAxisLabel}>{a.label}</Text>
              <Text style={styles.modalAxisBody}>{a.body}</Text>
            </View>
          ))}
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
  headerMeta: {
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

  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
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
  modalAxisRow: {
    marginTop: Spacing.one,
  },
  modalAxisLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalAxisBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
});
