import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { RadarChart, buildRadarAxes } from '@/components/insights/radar-chart';

const HORIZONTAL_MARGIN = 40;

/**
 * Team Profile radar card. Purely a graphic panel — team selection lives
 * outside in the selector row above. When a compare team is set, its
 * polygon is overlaid on the primary team's polygon (dashed grey outline).
 */
export function InsightsCanvas({
  primaryTeamId,
  compareTeamId,
}: {
  primaryTeamId: string | null;
  compareTeamId?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data: agg, isLoading } = useTeamAggregate(primaryTeamId ?? '');
  const { data: compareAgg } = useTeamAggregate(compareTeamId ?? '');
  const primaryTeam = useTeam(primaryTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');

  const axes = useMemo(() => buildRadarAxes(agg), [agg]);
  const compareAxes = useMemo(
    () => (compareTeamId ? buildRadarAxes(compareAgg) : null),
    [compareTeamId, compareAgg],
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
      </View>
      <Text style={styles.tagline}>Six-axis profile of the selected team</Text>

      {agg && agg.gamesPlayed > 0 ? (
        <>
          <RadarChart axes={axes} compareAxes={compareAxes} />
          {/* Legend — quiet xs strip identifying which polygon belongs to
              which team. Deliberately muted so the radar reads first. */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={styles.legendSwatchPrimary} />
              <Text style={styles.legendLabelPrimary}>
                {primaryTeam.data?.short_name ?? primaryTeamId?.toUpperCase() ?? '—'}
              </Text>
            </View>
            {compareTeamId ? (
              <View style={styles.legendItem}>
                <View style={styles.legendSwatchCompare} />
                <Text style={styles.legendLabelCompare}>
                  {compareTeam.data?.short_name ?? compareTeamId.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>
          {isLoading ? 'Loading…' : 'No completed matches to profile yet.'}
        </Text>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Team Profile</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Six-axis rugby analytics radar for the selected team. Axes cover
            {' '}<Text style={styles.modalStrong}>Attack</Text>,
            {' '}<Text style={styles.modalStrong}>Defence</Text>,
            {' '}<Text style={styles.modalStrong}>Set-piece</Text>,
            {' '}<Text style={styles.modalStrong}>Discipline</Text>,
            {' '}<Text style={styles.modalStrong}>Kicking</Text>, and
            {' '}<Text style={styles.modalStrong}>Territory</Text>. The dashed
            hexagon at 50% radius is the notional international average.
          </Text>
          <Text style={styles.modalBody}>
            Add a compare team from the selector above the card — its polygon
            overlays as a dashed grey outline for head-to-head reading.
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
  tagline: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    marginTop: -Spacing.one,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  // ─── Legend ────────────────────────────────────────────────────────────
  // Row of tiny series indicators under the radar. xs text + slim swatches
  // so the whole strip reads as annotation, not chart.
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatchPrimary: {
    width: 14,
    height: 6,
    backgroundColor: Colors.light.text,
    borderRadius: 2,
  },
  // Compare swatch mirrors the compare polygon: dashed grey outline, no fill.
  legendSwatchCompare: {
    width: 14,
    height: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.textSecondary,
    borderStyle: 'dashed',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  legendLabelPrimary: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.text,
  },
  legendLabelCompare: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
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
