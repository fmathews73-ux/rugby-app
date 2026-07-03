import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { RadarChart, buildRadarAxes } from '@/components/insights/radar-chart';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

/**
 * Profile radar card. When only `primaryTeamId` is set, renders that
 * team's polygon. When a compare team is also present, a two-segment toggle
 * pill in the header (`[HOME | AWAY]`) lets the user pick which team's
 * polygon shows — one at a time, no overlay. The 50%-reference hexagon
 * shows in both modes since a single polygon needs the "vs what?" anchor.
 */
export function InsightsCanvas({
  primaryTeamId,
  compareTeamId,
}: {
  primaryTeamId: string | null;
  compareTeamId?: string | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');

  // Reset toggle back to the primary side whenever the compare team changes
  // or is cleared — avoids the pill sitting on a stale "compare" selection
  // after the user picks a different team.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(primaryTeamId ?? '');
  const compareTeam = useTeam(compareTeamId ?? '');
  const { data: primaryAgg, isLoading: primaryLoading } = useTeamAggregate(primaryTeamId ?? '');
  const { data: compareAgg, isLoading: compareLoading } = useTeamAggregate(compareTeamId ?? '');

  const primaryAxes = useMemo(() => buildRadarAxes(primaryAgg), [primaryAgg]);
  const compareAxes = useMemo(() => buildRadarAxes(compareAgg), [compareAgg]);

  const hasCompare = compareTeamId !== null && compareTeamId !== undefined && compareTeamId !== '';
  const activeAxes = activeSide === 'primary' ? primaryAxes : compareAxes;
  const activeAgg = activeSide === 'primary' ? primaryAgg : compareAgg;
  const activeLoading = activeSide === 'primary' ? primaryLoading : compareLoading;

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
        {hasCompare ? (
          <TeamToggle
            primaryLabel={primaryTeam.data?.short_name ?? primaryTeamId?.toUpperCase() ?? '—'}
            compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
            activeSide={activeSide}
            onSelect={setActiveSide}
          />
        ) : null}
      </View>

      {activeAgg && activeAgg.gamesPlayed > 0 ? (
        <RadarChart axes={activeAxes} />
      ) : (
        <Text style={styles.empty}>
          {activeLoading ? 'Loading…' : 'No completed matches to profile yet.'}
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
            <Text style={styles.modalTitle}>Profile</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Eight-axis rugby analytics radar for the selected team. Axes cover
            {' '}<Text style={styles.modalStrong}>Attack</Text>,
            {' '}<Text style={styles.modalStrong}>Defence</Text>,
            {' '}<Text style={styles.modalStrong}>Set-piece</Text>,
            {' '}<Text style={styles.modalStrong}>Discipline</Text>,
            {' '}<Text style={styles.modalStrong}>Kicking</Text>,
            {' '}<Text style={styles.modalStrong}>Territory</Text>,
            {' '}<Text style={styles.modalStrong}>Possession</Text>, and
            {' '}<Text style={styles.modalStrong}>Turnovers</Text>. The dashed
            octagon at 50% radius is the notional international average.
          </Text>
          <Text style={styles.modalBody}>
            When two teams are on the page, the header carries a
            {' '}<Text style={styles.modalStrong}>toggle pill</Text> with each
            team's three-letter code. Tap either side to switch which polygon
            the radar shows — one team at a time, no overlay.
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
