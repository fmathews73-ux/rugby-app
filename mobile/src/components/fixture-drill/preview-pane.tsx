import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { CardCarousel } from '@/components/card-carousel';
import { PreMatchAnalysisCard } from '@/components/fixture-drill/pre-match-analysis-card';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { Spacing } from '@/constants/theme';

// ─── Preview pane ────────────────────────────────────────────────────────────

/**
 * Pre-match team context — recent form, WR ranking, and prev-10 KPI
 * averages for both sides, in the same paged card carousel as the Home
 * my-team block (Form → World Ranking → KPIs, dot indicator, cards
 * height-normalised via flex). Each card's two-side toggle pill
 * switches between home and away; every card is frozen to the state as
 * of kickoff.
 */
export function PreviewPane({
  fixture,
  homeTeamId,
  awayTeamId,
  asOfDate,
}: {
  fixture: Fixture;
  homeTeamId: string;
  awayTeamId: string;
  /** Freezes every card on this pane to the state it would have shown
   *  the day of the fixture — Form / Ranking / KPIs all drop data
   *  timestamped at or after this ISO string. Makes a fixture opened
   *  in 2027 still read as the *pre-match* view from 2025. */
  asOfDate: string;
}) {
  return (
    <View style={styles.insightsPaneStack}>
      {/* Full-screen-width carousel pages need to escape the drill
          pane's 24pt horizontal padding — the negative margin bleeds
          the carousel back to the screen edges; each page re-applies
          the card column inset internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel
          pages={[
            <ExtendedMomentum
              key="form"
              teamId={homeTeamId}
              compareTeamId={awayTeamId}
              asOfDate={asOfDate}
              style={styles.pageCard}
            />,
            <RankingTrajectory
              key="ranking"
              teamId={homeTeamId}
              compareTeamId={awayTeamId}
              asOfDate={asOfDate}
              style={styles.pageCard}
            />,
            <EfficiencyKpis
              key="kpis"
              teamId={homeTeamId}
              compareTeamId={awayTeamId}
              asOfDate={asOfDate}
              style={styles.pageCard}
            />,
          ]}
        />
      </View>

      {/* The written pre-match read — what the numbers above amount to.
          Scheduled fixtures only; collapses to a pointer once live. */}
      <PreMatchAnalysisCard fixture={fixture} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  insightsPaneStack: { gap: Spacing.three },
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
});
