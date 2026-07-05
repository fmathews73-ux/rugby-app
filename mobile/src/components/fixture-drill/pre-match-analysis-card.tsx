import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMatchPreview, type PreviewAxisKey } from '@/hooks/use-match-preview';

// Same glyph per axis as the match analysis card, so the pre-match and
// post-match reads line up section for section.
const AXIS_ICONS: Record<PreviewAxisKey, keyof typeof Ionicons.glyphMap> = {
  attack: 'flash-outline',
  defence: 'shield-outline',
  'set-piece': 'layers-outline',
  discipline: 'warning-outline',
  kicking: 'send-outline',
  territory: 'map-outline',
  possession: 'american-football-outline',
  turnovers: 'swap-horizontal-outline',
};

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
export function PreMatchAnalysisCard({ fixture }: { fixture: Fixture }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = useMatchPreview(fixture.id);
  const isScheduled = fixture.status === 'scheduled';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
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
        {!isScheduled ? <Text style={styles.metaChip}>AS OF KICKOFF</Text> : null}
      </View>

      {isLoading && !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !data ? (
        <Text style={styles.empty}>
          Not enough completed matches on either side to preview this one yet.
        </Text>
      ) : (
        <View style={styles.narrativeStack}>
          {/* Cold-open billing — no label, mirroring the other cards. */}
          <Text style={styles.narrativeBody}>{data.summary}</Text>

          <Section label="The shape of it" icon="analytics-outline">
            {data.shape}
          </Section>
          {/* Per-axis coming-in comparison — same taxonomy and order as
              the match analysis, so readers can line the two up. */}
          {data.axes.map((axis) => (
            <Section key={axis.key} label={axis.label} icon={AXIS_ICONS[axis.key]}>
              {axis.narrative}
            </Section>
          ))}
          {data.danger ? (
            <Section label="Danger periods" icon="time-outline">
              {data.danger}
            </Section>
          ) : null}
          <Section label="Keys to the match" icon="key-outline">
            {data.keys}
          </Section>
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
              and the card never predicts a result: Keys to the match are the
              conditions each side needs to meet, not a call on who wins.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Section({
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
