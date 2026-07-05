import { StyleSheet, View } from 'react-native';

import { CardCarousel } from '@/components/card-carousel';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { MyTeamProfileCard } from '@/components/my-team-profile-card';
import { TeamAnalysisCard } from '@/components/team-analysis-card';
import { Spacing } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

/**
 * Home-page my-team analytics block. The Profile radar card keeps its
 * own full-width slot (its dimensions are untouched); the OTHER chart
 * cards — Form (last 10), World Ranking, Efficiency KPIs — live in the
 * shared CardCarousel beneath it, so the stack stays short without
 * losing any card.
 *
 * Same components as `PreviewPane` on the fixture drill; no
 * `compareTeamId` (toggle pill hidden) and no `asOfDate` (current
 * state, not a kickoff snapshot).
 *
 * Reads `useMyTeamId`; returns nothing until a team is selected —
 * [[team-selector-card]] above handles that prompt.
 */
export function MyTeamPreviewCards() {
  const [myTeamId] = useMyTeamId();
  if (!myTeamId) return null;

  return (
    <>
      <View style={styles.wrap}>
        <MyTeamProfileCard />
      </View>

      {/* "My Team ..." titles + no corner flag — the whole stack is
          already scoped to the selected team. */}
      <CardCarousel
        pages={[
          <ExtendedMomentum
            key="form"
            teamId={myTeamId}
            style={styles.pageCard}
            title="Team Form"
            showCornerFlag={false}
          />,
          <RankingTrajectory
            key="ranking"
            teamId={myTeamId}
            style={styles.pageCard}
            title="Team World Ranking"
            showCornerFlag={false}
          />,
          <EfficiencyKpis
            key="kpis"
            teamId={myTeamId}
            style={styles.pageCard}
            title="Team Efficiency KPIs"
            showCornerFlag={false}
          />,
        ]}
      />

      {/* Written synthesis below the charts — the same Team Analysis
          card as the team drill, scoped to the selected team. */}
      <View style={styles.wrap}>
        <TeamAnalysisCard teamId={myTeamId} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
  },
  pageCard: {
    flex: 1,
  },
});
