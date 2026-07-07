import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { useLatestRanking } from '@/api/hooks';
import { TeamHeroRow } from '@/components/team-hero-row';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TIER_1_IDS } from '@/lib/tiers';

/**
 * Full-screen modal for picking a team. Default use case is picking a
 * favourite team ("My Team") but the modal is reusable for any single-team
 * selection — supply `title` and `confirmLabel` to retitle. Tap a row to
 * select; the selection is provisional until Confirm is tapped. Cancel
 * discards the change.
 */
export function TeamPickerModal({
  visible,
  teams,
  currentTeamId,
  title = 'Select your team',
  confirmLabel = 'Select',
  onCancel,
  onConfirm,
  onClear,
}: {
  visible: boolean;
  teams: readonly Team[];
  currentTeamId: string | null;
  /** Header title. Defaults to "Select your team" for the primary favourite-team flow. */
  title?: string;
  /** Primary-button label. Defaults to "Confirm". */
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (teamId: string) => void;
  /** Resets the current selection. Only shown when one is set — nothing to clear otherwise. */
  onClear?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentTeamId);

  // Reset provisional selection each time the modal opens.
  useEffect(() => {
    if (visible) setSelected(currentTeamId);
  }, [visible, currentTeamId]);

  // Latest men's World Rugby snapshot — annotates each row with the
  // team's current rank + points for the shared hero-row meta line.
  const rankings = useLatestRanking();
  const rankRowByTeam = useMemo(() => {
    const m = new Map<string, { rank: number; points: number }>();
    for (const row of rankings.data?.rows ?? []) m.set(row.team_id, { rank: row.rank, points: row.points });
    return m;
  }, [rankings.data]);

  // Grouped exactly like the Teams landing page: Tier 1 / Tier 2
  // Nations, best world ranking first within each group.
  const groups = useMemo(() => {
    const tier1: Team[] = [];
    const tier2: Team[] = [];
    for (const t of teams) (TIER_1_IDS.has(t.id) ? tier1 : tier2).push(t);
    const byRank = (a: Team, b: Team) => {
      const ra = rankRowByTeam.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = rankRowByTeam.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    };
    tier1.sort(byRank);
    tier2.sort(byRank);
    return [
      { label: 'Tier 1 Nations', teams: tier1 },
      { label: 'Tier 2 Nations', teams: tier2 },
    ];
  }, [teams, rankRowByTeam]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel">
            {/* Same circle-outline treatment as the app header's back
                button. */}
            <Ionicons
              name="chevron-back-circle-outline"
              size={28}
              color={Colors.light.textSecondary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          {/* Right slot: Clear reset button when a team is already set,
              otherwise an invisible spacer to keep the title centred. */}
          {onClear && currentTeamId ? (
            <Pressable
              onPress={onClear}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Clear selection">
              <Ionicons
                name="refresh-circle-outline"
                size={28}
                color={Colors.light.textSecondary}
              />
            </Pressable>
          ) : (
            <View style={styles.headerActionSpacer} />
          )}
        </View>

        <FlatList
          data={groups}
          keyExtractor={(g) => g.label}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.groupCard}>
              {/* Title inside the card — same header treatment as the
                  Teams landing / Fixtures day cards. */}
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>{group.label}</Text>
              </View>
              <View style={styles.rowDivider} />
              {group.teams.map((t, i) => (
                <TeamRow
                  key={t.id}
                  team={t}
                  rankRow={rankRowByTeam.get(t.id)}
                  selected={selected === t.id}
                  onSelect={() => setSelected(t.id)}
                  isLast={i === group.teams.length - 1}
                />
              ))}
            </View>
          )}
        />

        <View style={styles.footer}>
          <Pressable
            onPress={() => selected && onConfirm(selected)}
            disabled={selected === null}
            style={({ pressed }) => [
              styles.confirmPill,
              selected === null && styles.confirmPillDisabled,
              pressed && styles.confirmPillPressed,
            ]}>
            <Text style={styles.confirmPillText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * One row in the picker list — the shared TeamHeroRow (flag + CODE
 * left, rank · points · trophies and last-5 record stacked right) with
 * the selection checkmark as the right accessory, matching the Home
 * Team Selector card and the Teams directory's My Team spotlight.
 */
function TeamRow({
  team,
  rankRow,
  selected,
  onSelect,
  isLast,
}: {
  team: Team;
  rankRow: { rank: number; points: number } | undefined;
  selected: boolean;
  onSelect: () => void;
  isLast: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <TeamHeroRow
          team={team}
          rankRow={rankRow}
          right={
            // Radio affordance on every row — chrome-grey ring that
            // fills solid on selection (ring and fill share one size).
            <View style={[styles.radio, selected && styles.radioSelected]} />
          }
        />
      </Pressable>
      {!isLast ? <View style={styles.rowDivider} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerAction: { fontSize: TextSize.md, color: Colors.light.text, fontWeight: TextWeight.semibold },
  // Reset / clear — same weight as Cancel, tinted red to signal it undoes
  // the current My Team selection. Matches iOS "destructive action" tone.
  headerActionDestructive: { fontSize: TextSize.md, color: StatusColor.live, fontWeight: TextWeight.semibold },
  headerActionSpacer: { width: 60 },
  headerTitle: { fontFamily: 'Barlow_600SemiBold', fontSize: TextSize.lg, color: Colors.light.text },

  listContent: {
    padding: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: 40,
    gap: Spacing.three,
  },

  // Group card + rows — identical grammar to the Teams landing page
  // (title inside the card, hairline dividers spanning full width).
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },
  groupHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    // Symmetric air above and below the centred title; the inset
    // hairline below is rendered as a rowDivider sibling.
    paddingVertical: Spacing.three,
  },
  groupHeaderText: {
    // List-group header, not a chart-card title — meta register, title
    // case (same as the Fixtures day-card date headers).
    fontFamily: 'Barlow_500Medium',
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 4,
  },
  // Standalone inset divider — chevron-chrome grey with the same 16pt
  // side inset as the Home Next/Last Match card's hairline.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C7CBD1',
    marginHorizontal: Spacing.three,
  },
  rowPressed: { backgroundColor: '#F3F4F6' },
  radio: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C7CBD1',
  },
  radioSelected: {
    backgroundColor: Colors.light.textSecondary,
    borderColor: Colors.light.textSecondary,
  },

  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  // Compact pill centred in the footer — the picker is primarily a
  // tap-a-row surface, so Confirm just seals the choice. Wide
  // "primary CTA" bar visually overweighted a secondary action.
  confirmPill: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPillPressed: { opacity: 0.85 },
  confirmPillDisabled: { backgroundColor: '#9CA3AF' },
  confirmPillText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: TextSize.md,
    color: Colors.light.textInverse,
  },
});
