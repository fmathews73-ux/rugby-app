import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLatestRanking, useTeams } from '@/api/hooks';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { InsightsSelector } from '@/components/insights/insights-selector';
import { PointsPattern } from '@/components/insights/points-pattern';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { TeamPickerModal } from '@/components/team-picker-modal';
import { Spacing } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';
import { TIER_1_TEAM_IDS } from '@/lib/tier1';

type PickerFor = 'primary' | 'compare';

/**
 * Insights — single-page BI. Selector row (primary + optional compare) drives
 * every graphic card below. Radar overlays the compare team when set; other
 * panels (momentum, trajectory, KPIs) show data for the primary team only —
 * compare on those can come later.
 *
 * No page-level title/tagline — matches Home and Fixtures, which jump
 * straight into content under the app header.
 */
export default function InsightsScreen() {
  const [myTeamId] = useMyTeamId();
  const ranking = useLatestRanking();
  const teams = useTeams();

  const [primaryOverrideId, setPrimaryOverrideId] = useState<string | null>(null);
  const [compareTeamId, setCompareTeamId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<PickerFor | null>(null);

  const topRankedTeamId = useMemo(() => {
    return ranking.data?.rows.find((r) => r.rank === 1)?.team_id ?? null;
  }, [ranking.data]);

  // Priority: manual primary override > user's My Team > World #1 fallback.
  const primaryTeamId = primaryOverrideId ?? myTeamId ?? topRankedTeamId;

  // Each picker excludes the OTHER side's current selection so the same team
  // can't sit on both sides simultaneously.
  const pickerPool = useMemo(() => {
    const t1 = new Set<string>(TIER_1_TEAM_IDS);
    const excludeId = pickerFor === 'primary' ? compareTeamId : primaryTeamId;
    return (teams.data ?? []).filter((t) => t1.has(t.id) && t.id !== excludeId);
  }, [teams.data, pickerFor, primaryTeamId, compareTeamId]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <InsightsSelector
          primaryTeamId={primaryTeamId}
          compareTeamId={compareTeamId}
          onOpenPrimaryPicker={() => setPickerFor('primary')}
          onOpenComparePicker={() => setPickerFor('compare')}
          onClearCompare={() => setCompareTeamId(null)}
        />

        <InsightsCanvas
          primaryTeamId={primaryTeamId}
          compareTeamId={compareTeamId}
        />

        {primaryTeamId ? (
          <>
            <ExtendedMomentum teamId={primaryTeamId} />
            <PointsPattern teamId={primaryTeamId} mode="scored" />
            <PointsPattern teamId={primaryTeamId} mode="conceded" />
            <RankingTrajectory teamId={primaryTeamId} />
            <EfficiencyKpis teamId={primaryTeamId} />
          </>
        ) : null}
      </ScrollView>

      <TeamPickerModal
        visible={pickerFor !== null}
        teams={pickerPool}
        currentTeamId={pickerFor === 'primary' ? primaryTeamId : compareTeamId}
        title={pickerFor === 'compare' ? 'Compare vs…' : 'Pick a team'}
        confirmLabel={pickerFor === 'compare' ? 'Compare' : 'Show'}
        onCancel={() => setPickerFor(null)}
        onConfirm={(id) => {
          if (pickerFor === 'compare') {
            setCompareTeamId(id);
          } else {
            setPrimaryOverrideId(id);
          }
          setPickerFor(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
});
