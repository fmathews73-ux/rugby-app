import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { FormCircles } from '@/components/form-circles';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { Colors, FlagSize, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { useTeamRecentForm } from '@/hooks/use-team-recent-form';
import { worldCupTitles } from '@/lib/world-cup-titles';

const FORM_LOOKBACK = 5;

/**
 * Standalone Home-page card whose only job is to select the user's
 * favourite team. Sits at the top of the "my team" stack; the next-and-
 * last-match card and the my-team Preview cards below it all read from
 * the same `useMyTeamId` state and re-render when this card changes it.
 *
 * When a team is chosen, the card reads:
 *   [flag] CODE            [W L W W L]            [list]
 *          #3 🏆🏆🏆
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
  const selectedRank = useMemo(() => {
    if (!myTeamId || !rankings.data) return null;
    return rankings.data.rows.find((r) => r.team_id === myTeamId)?.rank ?? null;
  }, [myTeamId, rankings.data]);

  const { outcomes } = useTeamRecentForm(myTeamId ?? '', FORM_LOOKBACK);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          {selectedTeam ? (
            <View style={styles.teamGroup}>
              <TeamFlagBall2D flagCode={selectedTeam.flag_code} size={FlagSize.medium} />
              <View style={styles.teamTextStack}>
                <Text style={styles.teamCode} numberOfLines={1}>
                  {selectedTeam.short_name}
                </Text>
                {selectedRank !== null ? (
                  <Text style={styles.teamRank}>#{selectedRank}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Select your team</Text>
          )}
          {/* Centre: last-5 form circles. Absolute overlay so it lands at
              true card-centre irrespective of the (variable-width) team
              group on the left and the (fixed-width) list button on the
              right. `pointerEvents: none` so it never intercepts a tap. */}
          {selectedTeam ? (
            <View style={styles.formCenterOverlay} pointerEvents="none">
              <FormCircles outcomes={outcomes} lookback={FORM_LOOKBACK} />
            </View>
          ) : null}
          {/* Trophy overlay — absolute, spans from just past the form
              circles' right edge (`50% + FORM_CIRCLES_HALF_W`) to just
              before the list icon (`right: LIST_ICON_W`). Content is
              centred inside that range so the trophy badge lands dead
              centre between the last circle and the list icon. */}
          {selectedTeam && worldCupTitles(selectedTeam.id) > 0 ? (
            <View style={styles.trophyOverlay} pointerEvents="none">
              <View style={styles.trophyBadge}>
                <Ionicons name="trophy" size={12} color={Colors.light.textSecondary} />
                <Text style={styles.trophyCount}>X{worldCupTitles(selectedTeam.id)}</Text>
              </View>
            </View>
          ) : null}
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={12}
            style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Change favourite team">
            <Ionicons name="list-outline" size={20} color={Colors.light.text} />
          </Pressable>
        </View>
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

const HORIZONTAL_MARGIN = 30;

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  teamGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  // Two-line stack next to the flag: code on top, `#3 🏆🏆🏆` beneath.
  teamTextStack: {
    gap: 2,
    flexShrink: 1,
  },
  teamCode: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
  },
  // Trophy overlay — absolute-positioned so the badge lands dead centre
  // between the form-circles' right edge and the list icon's left edge.
  //   • left: 50% + FORM_CIRCLES_HALF_W (48pt) — just past the last
  //     circle (form circles are 96pt wide + centred).
  //   • right: LIST_ICON_W (24pt) + Spacing.three (16pt) — leaves the
  //     list icon slot free with a matching gap.
  // Content is centred, so the trophy badge lands at the midpoint of
  // this range irrespective of card width.
  trophyOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: 48,
    right: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trophyCount: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  teamRank: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  formCenterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
