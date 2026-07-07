import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { DisciplineTrend } from '@/components/insights/discipline-trend';
import { EfficiencyKpis } from '@/components/insights/efficiency-kpis';
import { ExtendedMomentum } from '@/components/insights/extended-momentum';
import { PossessionOutcome } from '@/components/insights/possession-outcome';
import { RankingTrajectory } from '@/components/insights/ranking-trajectory';
import { ScoringRhythm } from '@/components/insights/scoring-rhythm';
import { SetPieceDiscipline } from '@/components/insights/set-piece-discipline';
import { TeamLandscape } from '@/components/insights/team-landscape';
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
// STRICT 1:1 section ↔ page maps — one narrative per card, labels
// identical to the card titles (owner rule 2026-07-07). No ride-along
// pages: every swipe lands on a section, every section owns one chart.
const SECTION_PAGE: Record<string, number> = {
  __summary__: 0, // Team Profile — the title row's evidence
  'Team Form': 1,
  'Team World Ranking': 2,
  'Team Landscape': 3,
  'Team Efficiency KPIs': 4,
  'Scoring Rhythm': 5,
  'Possession vs Outcome': 6,
  'Set Piece & Discipline': 7,
  'Discipline Trend': 8,
};
const PAGE_SECTION: readonly string[] = [
  '__summary__',
  'Team Form',
  'Team World Ranking',
  'Team Landscape',
  'Team Efficiency KPIs',
  'Scoring Rhythm',
  'Possession vs Outcome',
  'Set Piece & Discipline',
  'Discipline Trend',
];

/** Home wrapper — the same block scoped to the selected My Team. */
export function MyTeamPreviewCards() {
  const [myTeamId] = useMyTeamId();
  if (!myTeamId) return null;
  return <TeamPreviewBlock teamId={myTeamId} />;
}

/**
 * Team-scoped preview block — the app's team read: synced chart
 * carousel (radar · Form · Ranking · KPIs · Set-Piece 2×2) + Team
 * Analysis accordion. Used by Home (My Team) and every team hub's
 * Preview pane, so reviewing ANY team is the exact My Team experience.
 */
export function TeamPreviewBlock({ teamId }: { teamId: string }) {
  const carouselRef = useRef<CardCarouselHandle>(null);
  // Single source of truth for the sync: taps in the analysis card and
  // swipes on the carousel both land here.
  const [section, setSection] = useState('__summary__');

  // (Re)entering the surface always lands on the first chart (radar)
  // with the accordion at its resting summary — a fresh read every
  // visit, regardless of where the user left the carousel.
  useFocusEffect(
    useCallback(() => {
      setSection('__summary__');
      carouselRef.current?.scrollToPage(0, false);
    }, []),
  );

  return (
    <>
      {/* "Team ..." titles + no corner flag — the whole stack is
          already scoped to the selected team. */}
      <CardCarousel
        ref={carouselRef}
        onPageChange={(i) => setSection(PAGE_SECTION[i] ?? '__summary__')}
        pages={[
          <TeamProfileCard key="profile" teamId={teamId} style={styles.pageCard} />,
          <ExtendedMomentum
            key="form"
            teamId={teamId}
            style={styles.pageCard}
            title="Team Form"
            showCornerFlag={false}
          />,
          <RankingTrajectory
            key="ranking"
            teamId={teamId}
            style={styles.pageCard}
            title="Team World Ranking"
            showCornerFlag={false}
          />,
          <TeamLandscape key="landscape" teamId={teamId} style={styles.pageCard} />,
          <EfficiencyKpis
            key="kpis"
            teamId={teamId}
            style={styles.pageCard}
            title="Team Efficiency KPIs"
            showCornerFlag={false}
          />,
          <ScoringRhythm key="rhythm" teamId={teamId} style={styles.pageCard} />,
          <PossessionOutcome key="possession" teamId={teamId} style={styles.pageCard} />,
          <SetPieceDiscipline key="setpiece" teamId={teamId} style={styles.pageCard} />,
          <DisciplineTrend key="discipline" teamId={teamId} style={styles.pageCard} />,
        ]}
      />

      {/* Written synthesis below the charts. Opening a section slides
          its chart into view above — prose names the pattern, the
          carousel shows the evidence. */}
      <View style={styles.wrap}>
        <TeamAnalysisCard
          teamId={teamId}
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
