import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { TeamHeroRow } from '@/components/team-hero-row';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { Colors, Spacing, TextSize, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

/**
 * Standalone Home-page card whose only job is to select the user's
 * favourite team. Sits at the top of the "my team" stack; the next-and-
 * last-match card and the my-team Preview cards below it all read from
 * the same `useMyTeamId` state and re-render when this card changes it.
 *
 * When a team is chosen the card renders the shared TeamHeroRow (flag +
 * CODE left, rank · points · trophies and last-5 record stacked right)
 * with the list button as the right accessory.
 *
 * Selection persists across launches via `useMyTeamId`.
 */
export function TeamSelectorCard() {
  const [myTeamId, setMyTeamId] = useMyTeamId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const teams = useTeams();

  const selectedTeam = useMemo(
    () => (myTeamId ? teams.data?.find((t) => t.id === myTeamId) : undefined),
    [myTeamId, teams.data],
  );

  const rankings = useLatestRanking();
  const selectedRankRow = useMemo(() => {
    if (!myTeamId || !rankings.data) return null;
    const row = rankings.data.rows.find((r) => r.team_id === myTeamId);
    return row ? { rank: row.rank, points: row.points } : null;
  }, [myTeamId, rankings.data]);

  const listButton = (
    <Pressable
      onPress={() => setPickerOpen(true)}
      hitSlop={12}
      style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel="Change favourite team">
      <Ionicons name="list-outline" size={20} color={Colors.light.text} />
    </Pressable>
  );

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {selectedTeam ? (
          <TeamHeroRow team={selectedTeam} rankRow={selectedRankRow} right={listButton} />
        ) : (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>Select your team</Text>
            {listButton}
          </View>
        )}
      </View>

      <TeamPickerModal
        visible={pickerOpen}
        teams={teams.data ?? []}
        currentTeamId={myTeamId}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(id) => {
          setMyTeamId(id);
          setPickerOpen(false);
        }}
        onClear={() => {
          setMyTeamId(null);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

// App-wide 24pt card column (matches Fixtures / Teams landing pages).
const HORIZONTAL_MARGIN = Spacing.four;

const styles = StyleSheet.create({
  page: { paddingHorizontal: HORIZONTAL_MARGIN },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: TextSize.md,
    fontWeight: TextWeight.regular,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  filterButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  filterButtonPressed: { backgroundColor: '#F3F4F6' },
});
