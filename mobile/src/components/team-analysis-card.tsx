import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { TEAM_SECTION_INFO, type SectionInfo } from '@/lib/analysis-section-info';

/**
 * Templated team narrative — same visual grammar as the match and player
 * analysis cards (small-caps mini-label + glyph above prose). Structure
 * and thresholds are defined by the "Team analysis" section of
 * `docs/analysis-narrative-spec.md`; `useTeamAnalysis` is the client-side
 * template implementation pending the Phase 6 LLM cutover.
 *
 * Shared by the team drill's Analysis pane and the Home my-team stack.
 */
export function TeamAnalysisCard({
  teamId,
  openSection: controlledSection,
  onOpenSection,
}: {
  teamId: string;
  /** When provided, the accordion is CONTROLLED — the parent owns the
   *  open section (two-way carousel sync). Omit for standalone use. */
  openSection?: string;
  /** Fires with the newly-open section key — lets the surface sync its
   *  chart carousel to the section being read. */
  onOpenSection?: (section: string) => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  // Accordion: exactly one section open at all times. The title row's
  // summary is the resting state — it starts open, closes when a
  // category dropdown opens, and reopens whenever the open dropdown is
  // closed (closing never leaves the card empty).
  const [internalSection, setInternalSection] = useState<string>('__summary__');
  const openSection = controlledSection ?? internalSection;
  const accordion = (label: string) => ({
    open: openSection === label,
    onToggle: () => {
      const next = openSection === label ? '__summary__' : label;
      setInternalSection(next);
      onOpenSection?.(next);
    },
  });

  const { data, isLoading } = useTeamAnalysis(teamId);

  return (
    <View style={styles.card}>
      {/* Card title doubles as the FIRST accordion section — it owns
          the cold-open summary. */}
      <Pressable
        style={styles.headerRow}
        onPress={accordion('__summary__').onToggle}
        accessibilityRole="button"
        accessibilityLabel="Toggle the team analysis summary">
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
        <Ionicons
          name={openSection === '__summary__' ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.light.textSecondary}
        />
      </Pressable>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>Analysis populates once the team has completed a match.</Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open summary — body of the title section above. */}
          {openSection === '__summary__' ? (
            <Text style={styles.narrativeBody}>{data.summary}</Text>
          ) : null}

          <NarrativeSection label="Form" onInfo={() => setSectionInfo(TEAM_SECTION_INFO['Form']!)} {...accordion("Form")}>
            {data.form}
          </NarrativeSection>
          <NarrativeSection label="Ranking" onInfo={() => setSectionInfo(TEAM_SECTION_INFO['Ranking']!)} {...accordion("Ranking")}>
            {data.ranking}
          </NarrativeSection>
          <NarrativeSection label="Season" onInfo={() => setSectionInfo(TEAM_SECTION_INFO['Season']!)} {...accordion("Season")}>
            {data.season}
          </NarrativeSection>
          <NarrativeSection label="Outlook" onInfo={() => setSectionInfo(TEAM_SECTION_INFO['Outlook']!)} {...accordion("Outlook")}>
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

      <Modal
        visible={sectionInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSectionInfo(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSectionInfo(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{sectionInfo?.title}</Text>
              <Pressable onPress={() => setSectionInfo(null)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            {sectionInfo?.paragraphs.map((para, i) => (
              <Text key={i} style={styles.modalBody}>
                {para}
              </Text>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function NarrativeSection({
  label,
  onInfo,
  children,
  open,
  onToggle,
}: {
  label: string;
  onInfo: () => void;
  children: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.narrativeSection}>
      <Pressable
        onPress={onToggle}
        style={styles.narrativeMiniLabelRow}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${label}`}>
        <View style={styles.narrativeMiniLabelGroup}>
          <Text style={styles.narrativeMiniLabel}>{label}</Text>
          <Pressable
            onPress={onInfo}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Explain ${label}`}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.light.textSecondary}
        />
      </Pressable>
      {open ? <Text style={styles.narrativeBody}>{children}</Text> : null}
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
    // Label + icon left, expand chevron right — the squad card's
    // dropdown-header grammar. Symmetric vertical padding keeps the
    // text dead-centre in the row height.
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  narrativeMiniLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
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
