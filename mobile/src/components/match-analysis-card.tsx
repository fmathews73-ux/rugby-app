import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { LivePulseDot } from '@/components/live-pulse-dot';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { type AxisKey, useMatchAnalysis } from '@/hooks/use-match-analysis';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Icon per axis — each glyph aligns loosely with the axis it labels
 * (shield for defence, map for territory, ball for possession, etc.).
 * Kept as a stable map so the card stays deterministic across renders.
 */
const AXIS_ICONS: Record<AxisKey, IoniconName> = {
  attack: 'flash-outline',
  defence: 'shield-outline',
  setPiece: 'layers-outline',
  discipline: 'warning-outline',
  kicking: 'send-outline',
  territory: 'map-outline',
  possession: 'american-football-outline',
  turnovers: 'swap-horizontal-outline',
};

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
export function MatchAnalysisCard({ fixture }: { fixture: Fixture }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading } = useMatchAnalysis(fixture.id);

  const hasNarrative =
    fixture.status === 'live' ||
    fixture.status === 'half-time' ||
    fixture.status === 'completed';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
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
        {data?.status === 'live' ? (
          <View style={styles.livePill}>
            <LivePulseDot color={Colors.light.background} />
            <Text style={styles.livePillLabel}>LIVE · {data.generatedAtMinute}&apos;</Text>
          </View>
        ) : data?.status === 'completed' ? (
          <Text style={styles.metaChip}>FULL-TIME</Text>
        ) : null}
      </View>

      {!hasNarrative ? (
        <Text style={styles.empty}>
          Analysis populates once the match is under way.
        </Text>
      ) : isLoading || !data ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <View style={styles.sectionsStack}>
          {/* Opening summary — no label. Acts as the analyst's cold-open
              sentence before the labeled sections take over. */}
          <Text style={styles.summary}>{data.summary}</Text>

          {/* Pre-match backdrop — form + coming-in season baseline. */}
          <NarrativeSection label="Coming in" icon="time-outline">
            <Text style={styles.body}>{data.context}</Text>
          </NarrativeSection>

          {/* Broadcast prose — shape / attack / platform. Rendered as
              three tight paragraphs under a single Commentary label so
              the section reads as one continuous analyst passage. */}
          <NarrativeSection label="Commentary" icon="mic-outline">
            {data.commentary.split('\n\n').map((paragraph, i) => (
              <Text key={i} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </NarrativeSection>

          {/* Variance callout — the deciding axes. */}
          <NarrativeSection label="Variance" icon="analytics-outline">
            <Text style={styles.body}>{data.variance}</Text>
          </NarrativeSection>

          {/* 8 per-axis narratives — each with its own small-caps label
              and axis-specific glyph. Same visual grammar as every other
              section on the card. */}
          {data.axes.map((axis) => (
            <NarrativeSection
              key={axis.key}
              label={axis.label}
              icon={AXIS_ICONS[axis.key]}>
              <Text style={styles.body}>{axis.narrative}</Text>
            </NarrativeSection>
          ))}

          {/* Closing forward-look — mirrors the "Coming in" opener. */}
          <NarrativeSection label="Going forward" icon="compass-outline">
            <Text style={styles.body}>{data.outlook}</Text>
          </NarrativeSection>
        </View>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
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
  icon,
  children,
}: {
  label: string;
  icon: IoniconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionMiniLabelRow}>
        <Ionicons name={icon} size={12} color={Colors.light.textSecondary} />
        <Text style={styles.sectionMiniLabel}>{label}</Text>
      </View>
      {children}
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
    justifyContent: 'center',
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
