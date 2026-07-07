import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMatchPreview } from '@/hooks/use-match-preview';
import {
  PRE_MATCH_AXIS_PAIRS,
  PRE_MATCH_SECTION_INFO,
  pairInfo,
  type SectionInfo,
} from '@/lib/analysis-section-info';

// Same glyph per axis as the match analysis card, so the pre-match and
// post-match reads line up section for section.

/**
 * Pre-Match Analysis — the broadcast-style read BEFORE kickoff: what
 * the numbers say this match will most likely be about. Every input is
 * frozen as of kickoff, and the card PERSISTS after the match — a
 * deliberate compare-read against the Analysis tab's post-match story
 * ("did it play out the way the numbers said it would?"). Live and
 * completed fixtures carry an "as of kickoff" chip so the framing is
 * explicit.
 *
 * Same visual grammar as the match / team / player analysis cards.
 * Structure and thresholds are defined by
 * `docs/analysis-narrative-spec.md` §11; `useMatchPreview` is the
 * client-side template implementation pending the Phase 6 LLM cutover.
 * Never predicts a winner — conditions, not outcomes.
 */
export function PreMatchAnalysisCard({
  fixture,
  openSection: controlledSection,
  onOpenSection,
}: {
  fixture: Fixture;
  /** When provided, the accordion is CONTROLLED — the parent owns the
   *  open section (two-way carousel sync). Omit for standalone use. */
  openSection?: string;
  /** Fires with the newly-open section key. */
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

  const { data, isLoading } = useMatchPreview(fixture.id);
  const isScheduled = fixture.status === 'scheduled';

  return (
    <View style={styles.card}>
      {/* Card title doubles as the FIRST accordion section — it owns
          the cold-open summary. */}
      <Pressable
        style={styles.headerRow}
        onPress={accordion('__summary__').onToggle}
        accessibilityRole="button"
        accessibilityLabel="Toggle the pre-match summary">
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Pre-Match Analysis</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the pre-match analysis">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.headerRightGroup}>
          {!isScheduled ? <Text style={styles.metaChip}>AS OF KICKOFF</Text> : null}
          <Ionicons
            name={openSection === '__summary__' ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#C7CBD1"
          />
        </View>
      </Pressable>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>
          Not enough completed matches on either side to preview this one yet.
        </Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open billing — body of the title section above. */}
          {openSection === '__summary__' ? (
            <Text style={styles.narrativeBody}>{data.summary}</Text>
          ) : null}

          {/* STRICT 1:1 — Shape and Keys merged under the evidence
              card's own title (they always shared the Profile H2H
              chart): battlegrounds first, then each side's key. */}
          <Section label="Profile H2H" onInfo={() => setSectionInfo(PRE_MATCH_SECTION_INFO['Profile H2H']!)} {...accordion("Profile H2H")}>
            {`${data.shape}\n\n${data.keys}`}
          </Section>
          {/* Paired coming-in comparisons — two axes per section for a
              denser read (both narratives, paragraph-separated), same
              pairings as the H2H chart pages above. */}
          {PRE_MATCH_AXIS_PAIRS.map((pair) => {
            const narratives = pair.keys
              .map((k) => data.axes.find((ax) => ax.key === k)?.narrative)
              .filter((n): n is string => Boolean(n));
            if (narratives.length === 0) return null;
            return (
              <Section
                key={pair.title}
                label={pair.title}
                onInfo={() => setSectionInfo(pairInfo(pair))}
                {...accordion(pair.title)}>
                {narratives.join('\n\n')}
              </Section>
            );
          })}
          {data.danger ? (
            <Section label="Danger Windows" onInfo={() => setSectionInfo(PRE_MATCH_SECTION_INFO['Danger Windows']!)} {...accordion("Danger Windows")}>
              {data.danger}
            </Section>
          ) : null}
        </View>
      )}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pre-Match Analysis</Text>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              What the numbers say this match will most likely be about, built from
              both sides&apos; last-10 per-game profiles, recent form, world rankings,
              and scoring-timing patterns — the same data the Preview charts show,
              read as one story.
            </Text>
            <Text style={styles.modalBody}>
              Battlegrounds are only named where the two profiles genuinely diverge,
              and the card never predicts a result: the Keys are the
              conditions each side needs to meet, not a call on who wins.
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

function Section({
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
          color="#C7CBD1"
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  // Same treatment as the match card's FULL-TIME chip.
  metaChip: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
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
