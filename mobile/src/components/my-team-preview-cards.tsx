import { StyleSheet, View } from 'react-native';

import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { MyTeamProfileCard } from '@/components/my-team-profile-card';
import { Spacing } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

// App-wide 24pt card column — matches FixtureCarousel's card width and
// the Fixtures / Teams landing pages.
const HORIZONTAL_MARGIN = Spacing.four;

/**
 * Home-page stack of the three fixture-drill Preview cards — Form
 * (last 10) / Ranking Trajectory / Efficiency KPIs — scoped to the user's
 * favourite team. Same components as `PreviewPane` on the fixture drill;
 * no `compareTeamId` (so the toggle pill stays hidden) and no `asOfDate`
 * (so cards render the current up-to-date state, not a snapshot frozen
 * at some fixture's kickoff).
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
      <View style={styles.wrap}>
        <ExtendedMomentum teamId={myTeamId} />
      </View>
      <View style={styles.wrap}>
        <RankingTrajectory teamId={myTeamId} />
      </View>
      <View style={styles.wrap}>
        <EfficiencyKpis teamId={myTeamId} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Each card is horizontally boxed to match the Team-Selector and
  // My-Team-Matches cards above (40pt outer margin). Home's ScrollView
  // supplies the inter-card `gap: Spacing.three`.
  wrap: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
});
