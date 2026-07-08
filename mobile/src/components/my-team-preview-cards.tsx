import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';

import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { AerialContest } from '@/components/insights/aerial-contest';
import { DisciplineTrend } from '@/components/insights/discipline-trend';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { PossessionOutcome } from '@/components/insights/possession-outcome';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { ScoringRhythm } from '@/components/insights/scoring-rhythm';
import { SetPieceDiscipline } from '@/components/insights/set-piece-discipline';
import { TeamLandscape } from '@/components/insights/team-landscape';
import { TeamProfileCard } from '@/components/my-team-profile-card';
import { useMyTeamId } from '@/hooks/use-my-team-id';

/**
 * Home-page my-team analytics block — ONE charting carousel where every
 * card carries its own narrative on its flip side (info icon → flip).
 * The old analysis accordion + two-way sync is gone (owner call
 * 2026-07-07): the card IS the unit of insight — chart on the front,
 * purpose + read on the back.
 */

/** Home wrapper — the same block scoped to the selected My Team. */
export function MyTeamPreviewCards() {
  const [myTeamId] = useMyTeamId();
  if (!myTeamId) return null;
  return <TeamPreviewBlock teamId={myTeamId} />;
}

/**
 * Team-scoped preview block — the app's team read: the chart carousel
 * (radar · Form · Ranking · KPIs · Set-Piece 2×2 · …), each card
 * flippable to its narrative. Used by Home (My Team) and every team
 * hub's Preview pane, so reviewing ANY team is the exact My Team
 * experience.
 */
export function TeamPreviewBlock({ teamId }: { teamId: string }) {
  const carouselRef = useRef<CardCarouselHandle>(null);

  // (Re)entering the surface always lands on the first chart (radar) —
  // a fresh read every visit, regardless of where the user left the
  // carousel.
  useFocusEffect(
    useCallback(() => {
      carouselRef.current?.scrollToPage(0, false);
    }, []),
  );

  return (
    // "Team ..." titles + no corner flag — the whole stack is already
    // scoped to the selected team.
    <CardCarousel
      ref={carouselRef}
      pages={[
        <TeamProfileCard key="profile" teamId={teamId} style={styles.pageCard} />,
        <ExtendedMomentum
          key="form"
          teamId={teamId}
          style={styles.pageCard}
          showCornerFlag={false}
        />,
        <RankingTrajectory
          key="ranking"
          teamId={teamId}
          style={styles.pageCard}
          showCornerFlag={false}
        />,
        <TeamLandscape key="landscape" teamId={teamId} style={styles.pageCard} />,
        <EfficiencyKpis
          key="kpis"
          teamId={teamId}
          style={styles.pageCard}
          showCornerFlag={false}
        />,
        <ScoringRhythm key="rhythm" teamId={teamId} style={styles.pageCard} />,
        <PossessionOutcome key="possession" teamId={teamId} style={styles.pageCard} />,
        <AerialContest key="aerial" teamId={teamId} style={styles.pageCard} showCornerFlag={false} />,
        <SetPieceDiscipline key="setpiece" teamId={teamId} style={styles.pageCard} />,
        <DisciplineTrend key="discipline" teamId={teamId} style={styles.pageCard} />,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pageCard: {
    flex: 1,
  },
});
