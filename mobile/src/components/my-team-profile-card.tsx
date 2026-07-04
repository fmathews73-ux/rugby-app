import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTeam } from '@/api/hooks';
import { RadarChart, buildRadarAxes } from '@/components/insights/radar-chart';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';

const LOOKBACK = 10;

/**
 * Home-page Profile radar for the user's team, aggregated over their most-
 * recent `LOOKBACK` completed fixtures. Same 8-axis polygon (Attack /
 * Defence / Set-piece / Discipline / Kicking / Territory / Possession /
 * Turnovers) as the fixture-drill Insights Profile card, but scoped to
 * the team's recent form window rather than a single 80-minute match.
 *
 * Sits directly above the Form (last 10) sparkline so the two cards
 * share the same lookback window — Form tells the story of the last 10
 * results; Profile tells the story of the *shape* of those results.
 *
 * Returns nothing until a team is selected — [[team-selector-card]]
 * handles the empty state.
 */
export function MyTeamProfileCard() {
  const [myTeamId] = useMyTeamId();
  if (!myTeamId) return null;
  return <Populated teamId={myTeamId} />;
}

function Populated({ teamId }: { teamId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const primaryTeam = useTeam(teamId);
  const { data: aggregate, isLoading } = useTeamAggregate(teamId, undefined, LOOKBACK);
  const axes = useMemo(() => buildRadarAxes(aggregate), [aggregate]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Profile (prev. {LOOKBACK})</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Profile radar">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {primaryTeam.data ? (
          <TeamFlagBall2D flagCode={primaryTeam.data.flag_code} size={FlagSize.xs} />
        ) : null}
      </View>

      {aggregate && aggregate.gamesPlayed > 0 ? (
        <RadarChart axes={axes} />
      ) : (
        <Text style={styles.empty}>
          {isLoading ? 'Loading…' : 'Not enough completed matches yet.'}
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
            <Text style={styles.modalTitle}>Profile (prev. {LOOKBACK})</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Eight-axis rugby analytics radar aggregating the team's most
            recent {LOOKBACK} completed matches. Axes cover
            {' '}<Text style={styles.modalStrong}>Attack</Text>,
            {' '}<Text style={styles.modalStrong}>Defence</Text>,
            {' '}<Text style={styles.modalStrong}>Set-piece</Text>,
            {' '}<Text style={styles.modalStrong}>Discipline</Text>,
            {' '}<Text style={styles.modalStrong}>Kicking</Text>,
            {' '}<Text style={styles.modalStrong}>Territory</Text>,
            {' '}<Text style={styles.modalStrong}>Possession</Text>, and
            {' '}<Text style={styles.modalStrong}>Turnovers</Text>. The
            dashed octagon at 50% radius is the notional international
            average.
          </Text>
          <Text style={styles.modalBody}>
            The window mirrors the Form (prev. {LOOKBACK}) sparkline
            immediately below — Form shows the sequence of results,
            Profile shows the shape of those results across the eight
            playing dimensions.
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
