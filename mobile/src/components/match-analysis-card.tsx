import { Ionicons } from '@expo/vector-icons';
import { Fragment, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { LivePulseDot } from '@/components/live-pulse-dot';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMatchAnalysis } from '@/hooks/use-match-analysis';
import { MATCH_AXIS_PAIRS, matchPairInfo } from '@/components/insights/match-h2h';
import {
  MATCH_SECTION_INFO,
  type SectionInfo,
} from '@/lib/analysis-section-info';


/**
 * Icon per axis — each glyph aligns loosely with the axis it labels
 * (shield for defence, map for territory, ball for possession, etc.).
 * Kept as a stable map so the card stays deterministic across renders.
 */

/**
 * BI-style match analysis card. A written analyst read of the match,
 * consistently rendered as a stack of labeled prose sections:
 *
 *   Summary (unlabeled opening paragraph)
 *   Coming in                    — pre-match context
 *   Commentary                   — broadcast-style shape/attack/platform
 *   Variance                     — biggest 2-3 axis gaps
 *   Attack, Defence, Set-piece,
 *   Discipline, Kicking,
 *   Territory, Possession,
 *   Turnovers                    — 8 axis narratives
 *   Going forward                — closing outlook, mirrors "Coming in"
 *
 * Every section follows the same visual grammar — a small-caps mini-label
 * followed by prose beneath. No boxed sub-cards, no tabular columns —
 * metrics are woven into the sentences. Consistent styling means the
 * eye reads section-to-section without visual jumps.
 *
 * Populates for live + completed fixtures; scheduled fixtures show an
 * empty state.
 *
 * ─── Spec source of truth ─────────────────────────────────────────────
 * The card structure, section order, section labels, and icon mapping
 * are defined by `docs/analysis-narrative-spec.md` — the same spec that
 * will act as the system prompt when the real LLM is wired up at Phase 6.
 * Do not add / remove / rename sections here without updating that doc
 * (and vice versa). The `useMatchAnalysis` hook it reads from is the
 * current template-based implementation of that spec; see the hook's
 * top-of-file TODO for the cutover plan.
 */
export function MatchAnalysisCard({
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

  const { data, isLoading } = useMatchAnalysis(fixture.id);

  const hasNarrative =
    fixture.status === 'live' ||
    fixture.status === 'half-time' ||
    fixture.status === 'completed';

  return (
    <View style={styles.card}>
      {/* Card title doubles as the FIRST accordion section — it owns
          the cold-open summary. */}
      <Pressable
        style={styles.headerRow}
        onPress={accordion('__summary__').onToggle}
        accessibilityRole="button"
        accessibilityLabel="Toggle the match analysis summary">
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Match Analysis</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain the Analysis card">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.headerRightGroup}>
          {data?.status === 'live' ? (
            <View style={styles.livePill}>
              <LivePulseDot color={Colors.light.background} />
              <Text style={styles.livePillLabel}>LIVE · {data.generatedAtMinute}&apos;</Text>
            </View>
          ) : data?.status === 'completed' ? (
            <Text style={styles.metaChip}>FULL-TIME</Text>
          ) : null}
          <Ionicons
            name={openSection === '__summary__' ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.light.textSecondary}
          />
        </View>
      </Pressable>

      {!hasNarrative ? (
        <Text style={styles.empty}>
          Analysis populates once the match is under way.
        </Text>
      ) : isLoading || !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <View style={styles.sectionsStack}>
          {/* Opening summary — body of the title section above. */}
          {openSection === '__summary__' ? (
            <Text style={styles.summary}>{data.summary}</Text>
          ) : null}

          {/* STRICT 1:1 — one section per carousel card, labels
              identical to card titles. Commentary was dissolved
              2026-07-07: its shape ¶ became Momentum, its flow ¶
              Scoring Progression, its attack/platform ¶s open the
              matching pair sections. */}
          <NarrativeSection label="Momentum" onInfo={() => setSectionInfo(MATCH_SECTION_INFO['Momentum']!)} {...accordion("Momentum")}>
            <Text style={styles.body}>{data.momentum}</Text>
          </NarrativeSection>

          <NarrativeSection label="Scoring Progression" onInfo={() => setSectionInfo(MATCH_SECTION_INFO['Scoring Progression']!)} {...accordion("Scoring Progression")}>
            <Text style={styles.body}>{data.progression}</Text>
          </NarrativeSection>

          <NarrativeSection label="Match Gaps" onInfo={() => setSectionInfo(MATCH_SECTION_INFO['Match Gaps']!)} {...accordion("Match Gaps")}>
            <Text style={styles.body}>{data.variance}</Text>
          </NarrativeSection>

          {/* Paired axis sections; Attack & Defence opens with the
              attack-pattern paragraph, Set Piece & Discipline with the
              platform paragraph. Pitch Heatmap slots after Kicking &
              Territory, matching the carousel order. */}
          {MATCH_AXIS_PAIRS.map((pair) => {
            const narratives = pair.keys
              .map((k) => data.axes.find((ax) => ax.key === k)?.narrative)
              .filter((n): n is string => Boolean(n));
            if (narratives.length === 0) return null;
            const opener =
              pair.title === 'Attack & Defence'
                ? data.attackPattern
                : pair.title === 'Set Piece & Discipline'
                  ? data.platform
                  : null;
            const paragraphs = opener ? [opener, ...narratives] : narratives;
            return (
              <Fragment key={pair.title}>
                <NarrativeSection
                  label={pair.title}
                  onInfo={() => setSectionInfo(matchPairInfo(pair))}
                  {...accordion(pair.title)}>
                  {paragraphs.map((n, i) => (
                    <Text key={i} style={styles.body}>
                      {n}
                    </Text>
                  ))}
                </NarrativeSection>
                {pair.title === 'Kicking & Territory' ? (
                  <NarrativeSection
                    label="Pitch Heatmap"
                    onInfo={() => setSectionInfo(MATCH_SECTION_INFO['Pitch Heatmap']!)}
                    {...accordion("Pitch Heatmap")}>
                    <Text style={styles.body}>{data.heatmap}</Text>
                  </NarrativeSection>
                ) : null}
              </Fragment>
            );
          })}

          {/* Closing verdict — seals the story; the pane's Control vs
              Conversion chart is its picture. */}
          <NarrativeSection label="Control vs Conversion" onInfo={() => setSectionInfo(MATCH_SECTION_INFO['Control vs Conversion']!)} {...accordion("Control vs Conversion")}>
            <Text style={styles.body}>{data.verdict}</Text>
          </NarrativeSection>
        </View>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
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

/**
 * One labeled prose tile. Small-caps mini-label + section-specific glyph
 * sits above the prose body — matching the grammar used across the whole
 * card so every section reads with the same visual weight and rhythm.
 */
function NarrativeSection({
  label,
  onInfo,
  children,
  open,
  onToggle,
}: {
  label: string;
  onInfo: () => void;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        style={styles.sectionMiniLabelRow}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${label}`}>
        <View style={styles.sectionMiniLabelGroup}>
          <Text style={styles.sectionMiniLabel}>{label}</Text>
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
      {open ? children : null}
    </View>
  );
}

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Match Analysis</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            A written analyst read of the match, running Coming in →
            Commentary → Variance → the eight profile axes (Attack,
            Defence, Set-piece, Discipline, Kicking, Territory, Possession,
            Turnovers) → Going forward. Metrics are woven into the prose
            rather than tabulated, since the numbers themselves live on
            the Stats and Insights tabs.
          </Text>
          <Text style={styles.modalBody}>
            The opener sets the pre-match backdrop; the closing outlook
            names the growth areas each side will want to sharpen going
            forward. In between, the eight axis paragraphs mirror the
            visual radar's structure so the copy and the chart reinforce
            each other.
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
  // Card-level "Analysis" label — matches the header treatment used on
  // every other insights card so this card sits in the same visual family.
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#DC2626',
  },
  livePillLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.background,
    letterSpacing: TextTracking.wide,
  },
  metaChip: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
  },

  // Vertical stack of narrative sections. Uses a fixed gap so every
  // labeled tile sits the same distance apart — that consistency IS the
  // visual grammar. No boxes, no dividers, no per-section chrome.
  sectionsStack: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },

  summary: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 22,
  },

  // A single labeled tile — mini-label + glyph on top, prose beneath.
  // This is the shared shape used by every section on the card (Coming
  // in, Commentary, Variance, the 8 axis reads, Going forward).
  section: {
    gap: 4,
  },
  sectionMiniLabelRow: {
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
  sectionMiniLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionMiniLabel: {
    fontSize: 10,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 22,
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
});
