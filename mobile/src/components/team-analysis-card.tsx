import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';

/**
 * Templated team narrative — same visual grammar as the match and player
 * analysis cards (small-caps mini-label + glyph above prose). Structure
 * and thresholds are defined by the "Team analysis" section of
 * `docs/analysis-narrative-spec.md`; `useTeamAnalysis` is the client-side
 * template implementation pending the Phase 6 LLM cutover.
 *
 * Shared by the team drill's Analysis pane and the Home my-team stack.
 */
export function TeamAnalysisCard({ teamId }: { teamId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = useTeamAnalysis(teamId);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Team Analysis</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the team analysis">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>Analysis populates once the team has completed a match.</Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open summary — no label, mirroring the other cards. */}
          <Text style={styles.narrativeBody}>{data.summary}</Text>

          <NarrativeSection label="Form read" icon="time-outline">
            {data.form}
          </NarrativeSection>
          <NarrativeSection label="Ranking read" icon="podium-outline">
            {data.ranking}
          </NarrativeSection>
          <NarrativeSection label="Season read" icon="analytics-outline">
            {data.season}
          </NarrativeSection>
          <NarrativeSection label="Going forward" icon="compass-outline">
            {data.outlook}
          </NarrativeSection>
        </View>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team Analysis</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              A written synthesis of the team&apos;s recent window: results and margins from the
              last 10 completed matches, the world-ranking trajectory across the monthly
              snapshots, and the per-game season profile behind the Insights charts.
            </Text>
            <Text style={styles.modalBody}>
              Reads are threshold-gated so the card only makes claims the numbers support: a
              streak needs 3 or more matches, dominance means a 7-point average margin, a
              set piece below 85% is flagged, and 12 or more penalties conceded per game is
              called out as a discipline problem.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function NarrativeSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: string;
}) {
  return (
    <View style={styles.narrativeSection}>
      <View style={styles.narrativeMiniLabelRow}>
        <Ionicons name={icon} size={12} color={Colors.light.textSecondary} />
        <Text style={styles.narrativeMiniLabel}>{label}</Text>
      </View>
      <Text style={styles.narrativeBody}>{children}</Text>
    </View>
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
  narrativeStack: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  narrativeSection: {
    gap: 4,
  },
  narrativeMiniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  narrativeMiniLabel: {
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  narrativeBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 22,
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
});
