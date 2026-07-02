import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLatestRanking, useTeam, useTeams } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/state-views';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { TeamRadar } from '@/components/insights/team-radar';
import { TeamFlagBall2D } from '@/components/team-flag-ball-2d';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { Colors, FlagSize, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { TIER_1_TEAM_IDS } from '@/hooks/use-t1-momentum';

const HORIZONTAL_MARGIN = 40; // Matches the BI card panels below the hero.

/**
 * Insights drill-in for a single team. Stacks four BI panels: Radar (attack/
 * defence profile), Extended Momentum (last-10 sparkline), Ranking Trajectory
 * (12-month line chart), and an Efficiency KPI strip.
 *
 * Compare mode: users can pick a second Tier-1 team from the header chip.
 * The compare team's data overlays on the Team Radar (v1 scope — other
 * panels ignore the compare selection for now). See `TeamRadar` for the
 * overlay's visual treatment.
 */
export default function InsightsTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const id = teamId ?? '';
  const team = useTeam(id);
  const ranking = useLatestRanking();
  const teams = useTeams();

  const [compareTeamId, setCompareTeamId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rankingRow = useMemo(() => {
    return ranking.data?.rows.find((r) => r.team_id === id);
  }, [ranking.data, id]);

  const compareTeam = useMemo(() => {
    if (!compareTeamId) return null;
    return teams.data?.find((t) => t.id === compareTeamId) ?? null;
  }, [teams.data, compareTeamId]);

  // Compare pool: Tier-1 minus the primary team currently in view.
  const comparePool = useMemo(() => {
    const t1 = new Set<string>(TIER_1_TEAM_IDS);
    return (teams.data ?? []).filter((t) => t.id !== id && t1.has(t.id));
  }, [teams.data, id]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: team.data?.name ?? 'Insights' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {team.isLoading ? (
          <LoadingState />
        ) : team.isError ? (
          <ErrorState error={team.error} />
        ) : team.data ? (
          <>
            <View style={styles.hero}>
              <TeamFlagBall2D flagCode={team.data.flag_code} size={FlagSize.header} />
              <View style={styles.heroText}>
                <Text style={styles.heroName}>{team.data.name}</Text>
                {rankingRow ? (
                  <Text style={styles.heroRank}>
                    World Rugby #{rankingRow.rank}
                    {rankingRow.movement && rankingRow.movement !== 0 ? (
                      <Text style={{ color: movementColor(rankingRow.movement) }}>
                        {'  '}
                        {rankingRow.movement > 0 ? '▲' : '▼'} {Math.abs(rankingRow.movement)}
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.compareRow}>
              {compareTeam ? (
                <View style={styles.compareChipActive}>
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    style={styles.compareChipActiveInner}
                    accessibilityRole="button"
                    accessibilityLabel={`Change compare team, currently ${compareTeam.name}`}>
                    <Text style={styles.compareChipVs}>vs</Text>
                    <TeamFlagBall2D flagCode={compareTeam.flag_code} size={FlagSize.row} />
                    <Text style={styles.compareChipName}>{compareTeam.short_name}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCompareTeamId(null)}
                    hitSlop={10}
                    style={styles.compareChipDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Clear compare team">
                    <Ionicons name="close" size={14} color={Colors.light.textInverse} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.compareChip,
                    pressed && styles.compareChipPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Compare against another team">
                  <Ionicons name="git-compare-outline" size={14} color={Colors.light.text} />
                  <Text style={styles.compareChipLabel}>Compare vs…</Text>
                </Pressable>
              )}
            </View>

            <TeamRadar teamId={id} compareTeamId={compareTeamId ?? undefined} />
            <ExtendedMomentum teamId={id} />
            <RankingTrajectory teamId={id} />
            <EfficiencyKpis teamId={id} />
          </>
        ) : null}
      </ScrollView>

      <TeamPickerModal
        visible={pickerOpen}
        teams={comparePool}
        currentTeamId={compareTeamId}
        title="Compare vs…"
        confirmLabel="Compare"
        onCancel={() => setPickerOpen(false)}
        onConfirm={(pickedId) => {
          setCompareTeamId(pickedId);
          setPickerOpen(false);
        }}
        onClear={() => {
          setCompareTeamId(null);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function movementColor(m: number): string {
  return m > 0 ? '#059669' : StatusColor.live;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  scroll: {
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  hero: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroText: { flex: 1, gap: 4 },
  heroName: {
    fontSize: TextSize.xl,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  heroRank: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    letterSpacing: TextTracking.wide,
  },

  // ─── Compare chip ─────────────────────────────────────────────────────────
  compareRow: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    flexDirection: 'row',
  },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  compareChipPressed: { backgroundColor: '#F3F4F6' },
  compareChipLabel: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    letterSpacing: TextTracking.wide,
  },
  // Active state: primary-text-filled pill, inverse-text label, small dismiss
  // circle inset on the right edge. Reads as an active filter.
  compareChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingLeft: Spacing.two,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compareChipActiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compareChipVs: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textInverse,
    textTransform: 'uppercase',
  },
  compareChipName: {
    fontSize: TextSize.sm,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textInverse,
  },
  compareChipDismiss: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
