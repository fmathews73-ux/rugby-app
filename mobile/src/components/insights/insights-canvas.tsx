import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import {
  RADAR_AWAY_FILL,
  RADAR_FILL,
  RadarChart,
  buildRadarAxes,
} from '@/components/insights/radar-chart';

/**
 * Profile radar card. When only `primaryTeamId` is set, renders that
 * team's polygon over the 50%-reference hexagon. When a compare team is
 * also present, BOTH polygons are overlaid on the same axes — primary
 * (home) in blue, compare (away) in purple. The two team polygons act
 * as each other's reference, so the 50%-hexagon is dropped in that mode.
 *
 * On the fixture-drill Insights tab the profile is *match-scoped* — the
 * polygons read as the story of *this* fixture. For scheduled matches
 * there is no such story yet, so `fixtureStatus === 'scheduled'` renders
 * an empty state instead of the teams' historical aggregate. Pass no
 * `fixtureStatus` (My Team on Home page) to always render the polygon
 * from whatever aggregate the caller supplies.
 */
export function InsightsCanvas({
  primaryTeamId,
  compareTeamId,
  fixtureStatus,
}: {
  primaryTeamId: string | null;
  compareTeamId?: string | null;
  fixtureStatus?: Fixture['status'];
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const primaryTeam = useTeam(primaryTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');
  const { data: primaryAgg, isLoading: primaryLoading } = useTeamAggregate(primaryTeamId ?? '');
  const { data: compareAgg, isLoading: compareLoading } = useTeamAggregate(compareTeamId ?? '');

  const primaryAxes = useMemo(() => buildRadarAxes(primaryAgg), [primaryAgg]);
  const compareAxes = useMemo(() => buildRadarAxes(compareAgg), [compareAgg]);

  const hasCompare = compareTeamId !== null && compareTeamId !== undefined && compareTeamId !== '';
  const primaryReady = Boolean(primaryAgg && primaryAgg.gamesPlayed > 0);
  const compareReady = Boolean(compareAgg && compareAgg.gamesPlayed > 0);
  const canRender = hasCompare ? primaryReady || compareReady : primaryReady;
  const isLoading = primaryLoading || (hasCompare && compareLoading);

  const primaryShort = primaryTeam.data?.short_name ?? primaryTeamId?.toUpperCase() ?? '—';
  const compareShort = compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Profile</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Profile radar">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {/* Legend replaces the old team toggle. Two colour-swatch chips
            identify which polygon belongs to which side, matching the
            treatment used on the Momentum card so the team-colour
            convention is consistent across the Insights tab. */}
        {/* Legend swatches use the polygon FILL tokens (light shades)
            so the chip colour reads as the polygon body colour rather
            than the darker stroke — matches what the eye actually sees
            in the chart. */}
        {hasCompare ? (
          <View style={styles.legend}>
            <LegendChip label={primaryShort} color={RADAR_FILL} />
            <LegendChip label={compareShort} color={RADAR_AWAY_FILL} />
          </View>
        ) : null}
      </View>

      {fixtureStatus === 'scheduled' ? (
        <Text style={styles.empty}>
          Profile populates once the match is under way.
        </Text>
      ) : canRender ? (
        // Both team polygons overlaid when a compare team is set — no
        // toggle needed. Home page single-team mode (no compareTeamId)
        // renders the primary polygon only against the 50%-reference
        // hexagon.
        <RadarChart
          axes={primaryReady ? primaryAxes : compareAxes}
          compareAxes={hasCompare && primaryReady && compareReady ? compareAxes : null}
        />
      ) : (
        <Text style={styles.empty}>
          {isLoading ? 'Loading…' : 'No completed matches to profile yet.'}
        </Text>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} hasCompare={hasCompare} />
    </View>
  );
}

function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function InfoModal({
  visible,
  onClose,
  hasCompare,
}: {
  visible: boolean;
  onClose: () => void;
  hasCompare: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Eight-axis rugby analytics radar. Axes cover
            {' '}<Text style={styles.modalStrong}>Attack</Text>,
            {' '}<Text style={styles.modalStrong}>Defence</Text>,
            {' '}<Text style={styles.modalStrong}>Set-piece</Text>,
            {' '}<Text style={styles.modalStrong}>Discipline</Text>,
            {' '}<Text style={styles.modalStrong}>Kicking</Text>,
            {' '}<Text style={styles.modalStrong}>Territory</Text>,
            {' '}<Text style={styles.modalStrong}>Possession</Text>, and
            {' '}<Text style={styles.modalStrong}>Turnovers</Text>.
          </Text>
          {hasCompare ? (
            <Text style={styles.modalBody}>
              Both team polygons are drawn on the same axes:
              {' '}<Text style={styles.modalStrong}>home</Text> in blue,
              {' '}<Text style={styles.modalStrong}>away</Text> in purple.
              Overlap regions naturally darken through blending, so the
              shape gaps between the two sides (the axes where one team's
              polygon reaches further than the other's) tell the profile
              story at a glance.
            </Text>
          ) : (
            <Text style={styles.modalBody}>
              The dashed octagon at 50% radius is the notional
              international average — the team's polygon reaching outside
              means above average on that axis, inside means below.
            </Text>
          )}
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
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
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
});
