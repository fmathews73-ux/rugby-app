import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, TextWeight } from '@/constants/theme';

export type SubTab = 'preview' | 'overview' | 'lineup' | 'stats' | 'insights' | 'analysis';

export const SUB_TABS: readonly { id: SubTab; label: string }[] = [
  // Temporal flow, synthesis at the end. Preview leads with pre-match
  // context (form, ranking trajectory, season baselines) — the backdrop
  // the match plays out against. Line-Up follows with the cast on the
  // day. Timeline is the running event log ("what happens / happened").
  // Stats is the numeric record; Insights the visual analytical read.
  // Analysis closes — the AI narrative synthesis that pulls everything
  // before it together into a written story. Reader flows left-to-right
  // through: expectation → cast → events → data → visual → narrative.
  { id: 'preview', label: 'Preview' },
  { id: 'lineup', label: 'Line-Up' },
  { id: 'overview', label: 'Timeline' },
  { id: 'stats', label: 'Stats' },
  { id: 'insights', label: 'Insights' },
  { id: 'analysis', label: 'Analysis' },
];

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────

export function SubTabBar({ tab, onSelect }: { tab: SubTab; onSelect: (t: SubTab) => void }) {
  // Segmented-control row: all six pills share the width equally so every
  // tab (crucially Analysis, at the far right) is always visible — no
  // horizontal scroll, no off-screen tabs. Labels auto-shrink a notch on
  // narrow devices (SE-class) rather than truncating. Same fill-based
  // active/inactive grammar as CompetitionPicker / TeamToggle.
  return (
    <View style={styles.subTabBarWrap}>
      <View style={styles.subTabBarInner}>
        {SUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              style={[styles.subTabPill, active ? styles.subTabPillActive : styles.subTabPillInactive]}>
              <Text
                style={[styles.subTabPillLabel, active ? styles.subTabPillLabelActive : styles.subTabPillLabelInactive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  subTabBarWrap: {
    // White strip continues the hero card into the tab-bar row so the top of
    // the screen reads as one bonded surface; the grey page background
    // starts BELOW the sub-tabs.
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    // Matches the fixture-detail page inset used by the matchup header and
    // all pane content. Also mirrors the CompetitionPicker's behaviour on
    // Fixtures / Standings where pills clip at the outer wrap boundary
    // rather than the raw screen edge — buffered fade instead of a hard
    // cut against the phone bezel.
    paddingHorizontal: Spacing.three,
  },
  subTabBarInner: {
    flexDirection: 'row',
    paddingVertical: Spacing.two + 2,
    gap: 4,
  },
  // Segmented-control pills — six equal-flex slots so every tab fits on
  // screen without scrolling. Borderless: fill alone carries the
  // active/inactive contrast, matching the TeamToggle pill treatment.
  subTabPill: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subTabPillActive: {
    backgroundColor: Colors.light.text,
  },
  subTabPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  subTabPillLabel: {
    fontSize: 11,
    fontWeight: TextWeight.bold,
    letterSpacing: 0.2,
  },
  subTabPillLabelActive: { color: Colors.light.background },
  subTabPillLabelInactive: { color: Colors.light.textSecondary },
});
