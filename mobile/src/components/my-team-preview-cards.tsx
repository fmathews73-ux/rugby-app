import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { SetPieceDiscipline } from '@/components/insights/set-piece-discipline';
import { TeamProfileCard } from '@/components/my-team-profile-card';
import { TeamAnalysisCard } from '@/components/team-analysis-card';
import { Spacing } from '@/constants/theme';
import { useMyTeamId } from '@/hooks/use-my-team-id';

/**
 * Home-page my-team analytics block — the app's surface grammar in
 * miniature: ONE charting carousel + ONE analysis dropdown card.
 * Every analysis section maps 1:1 to a carousel page, and opening a
 * section scrolls its evidence into view (insight ↔ chart). The radar
 * lives inside the carousel as the summary's page — no static chart.
 */
const SECTION_PAGE: Record<string, number> = {
  __summary__: 0, // Team Profile radar — the summary's evidence
  Form: 1,
  Ranking: 2,
  Season: 3, // per-game profile → Efficiency KPIs
  Outlook: 4, // repair jobs → Set-Piece & Discipline 2×2
};
const PAGE_SECTION: readonly string[] = ['__summary__', 'Form', 'Ranking', 'Season', 'Outlook'];

export function MyTeamPreviewCards() {
  const [myTeamId] = useMyTeamId();
  const carouselRef = useRef<CardCarouselHandle>(null);
  // Single source of truth for the sync: taps in the analysis card and
  // swipes on the carousel both land here.
  const [section, setSection] = useState('__summary__');

  // Returning to the Home tab always lands on the first chart (radar)
  // with the accordion at its resting summary — a fresh read every
  // visit, regardless of where the user left the carousel.
  useFocusEffect(
    useCallback(() => {
      setSection('__summary__');
      carouselRef.current?.scrollToPage(0, false);
    }, []),
  );

  if (!myTeamId) return null;

  return (
    <>
      {/* "Team ..." titles + no corner flag — the whole stack is
          already scoped to the selected team. */}
      <CardCarousel
        ref={carouselRef}
        onPageChange={(i) => setSection(PAGE_SECTION[i] ?? '__summary__')}
        pages={[
          <TeamProfileCard key="profile" teamId={myTeamId} style={styles.pageCard} />,
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
          <SetPieceDiscipline key="setpiece" teamId={myTeamId} style={styles.pageCard} />,
        ]}
      />

      {/* Written synthesis below the charts. Opening a section slides
          its chart into view above — prose names the pattern, the
          carousel shows the evidence. */}
      <View style={styles.wrap}>
        <TeamAnalysisCard
          teamId={myTeamId}
          openSection={section}
          onOpenSection={(next) => {
            setSection(next);
            const page = SECTION_PAGE[next];
            if (page !== undefined) carouselRef.current?.scrollToPage(page);
          }}
        />
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
