import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Team } from '@rugby-app/shared';

import { useLatestRanking } from '@/api/hooks';
import { FormCircles } from '@/components/form-circles';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { worldCupTitles } from '@/lib/world-cup-titles';

const PICKER_FORM_LOOKBACK = 5;

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
  title = 'My Team',
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  onClear,
}: {
  visible: boolean;
  teams: readonly Team[];
  currentTeamId: string | null;
  /** Header title. Defaults to "My Team" for the primary favourite-team flow. */
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

  const sortedTeams = useMemo(
    () => teams.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  // Latest men's World Rugby snapshot — used to annotate each row with the
  // team's current rank (`#3`). Falls back to `null` when the team isn't
  // in the snapshot (e.g. an unranked side).
  const rankings = useLatestRanking();
  const rankByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of rankings.data?.rows ?? []) m.set(row.team_id, row.rank);
    return m;
  }, [rankings.data]);

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
            <Ionicons
              name="chevron-back"
              size={26}
              color={Colors.light.text}
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
                name="refresh"
                size={26}
                color={Colors.light.text}
              />
            </Pressable>
          ) : (
            <View style={styles.headerActionSpacer} />
          )}
        </View>

        <FlatList
          data={sortedTeams}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <TeamRow
              team={item}
              rank={rankByTeam.get(item.id)}
              selected={selected === item.id}
              onSelect={() => setSelected(item.id)}
              isFirst={index === 0}
              isLast={index === sortedTeams.length - 1}
            />
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
 * One row in the picker list. Layout mirrors the Team Selector card on
 * the Home page:
 *   [flag]  CODE            [W L W W L]            [check]
 *           #3 🏆🏆🏆
 *
 * `useTeamRecentForm` is called per row so each row streams its own
 * last-5 form independently. TanStack Query dedupes the underlying
 * fixture-result fetches with other consumers (Home selector card,
 * per-team analytics), so overhead is minimal.
 */
function TeamRow({
  team,
  rank,
  selected,
  onSelect,
  isFirst,
  isLast,
}: {
  team: Team;
  rank: number | undefined;
  selected: boolean;
  onSelect: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { outcomes } = useTeamRecentForm(team.id, PICKER_FORM_LOOKBACK);
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        pressed && styles.rowPressed,
      ]}>
      <TeamFlagBall2D flagCode={team.flag_code} size={FlagSize.medium} />
      <View style={styles.rowText}>
        <Text style={styles.rowShort}>{team.short_name}</Text>
        {rank !== undefined ? <Text style={styles.rowRank}>#{rank}</Text> : null}
      </View>
      <View style={styles.rowFormSlot}>
        <FormCircles outcomes={outcomes} lookback={PICKER_FORM_LOOKBACK} />
      </View>
      {/* Fixed-width trophy slot renders empty for teams with no World
          Cup titles — reserving the space keeps every row's `rowFormSlot`
          the same flex-1 width, so the form circles land on the same
          vertical column across every row in the list. */}
      <View style={styles.rowTrophySlot}>
        {worldCupTitles(team.id) > 0 ? (
          <View style={styles.rowTrophyBadge}>
            <Ionicons name="trophy" size={12} color={Colors.light.textSecondary} />
            <Text style={styles.rowTrophyCount}>X{worldCupTitles(team.id)}</Text>
          </View>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={26} color={Colors.light.text} />
      ) : (
        <View style={styles.tickPlaceholder} />
      )}
    </Pressable>
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
  headerTitle: { fontSize: TextSize.lg, fontWeight: TextWeight.bold, color: Colors.light.text },

  listContent: {
    padding: Spacing.four,
    paddingBottom: 40,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  rowPressed: { backgroundColor: '#F3F4F6' },
  rowText: {
    // Column stack: code on top, rank + trophy row beneath.
    gap: 2,
    flexShrink: 1,
  },
  // 3-letter team code — matches the `teamCode` treatment used in the
  // Team Selector card and the FixtureCarouselCard hero row.
  rowShort: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Rank sits directly below the code in the text stack. No trophies
  // here anymore — they live above the form circles in the centre.
  rowRank: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  // Centre slot: form circles centred inside a flex-1 wrapper so they
  // land at the visual midpoint of the row regardless of how wide the
  // team-code text column is on the left.
  rowFormSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed 40pt slot reserved on every row so the flex-1 `rowFormSlot`
  // has a consistent width — form circles then land on the same vertical
  // column across every row regardless of whether that row's team has
  // any World Cup titles.
  rowTrophySlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTrophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rowTrophyCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tickPlaceholder: { width: 26, height: 26 },

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
  confirmPillText: { color: Colors.light.textInverse, fontSize: TextSize.sm, fontWeight: TextWeight.bold },
});
