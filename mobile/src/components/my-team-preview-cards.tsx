import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';

import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { PAGE_CARD_MIN_HEIGHT } from '@/constants/theme';
import { PossessionOutcome } from '@/components/insights/possession-outcome';
import { DefensiveIntegrity } from '@/components/insights/defensive-integrity';
import { RedZoneMatrix } from '@/components/insights/red-zone-matrix';
import { BreakdownTrade } from '@/components/insights/breakdown-trade';
import { BootRoi } from '@/components/insights/boot-roi';
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
      // Four movements (owner call 2026-07-09): identity/results/status,
      // then the control block (ball & field), the attack block, and
      // the contact-and-costs closer. Efficiency was CUT — pure
      // duplication of the dedicated cards + the Stats pills.
      pages={[
        <TeamProfileCard key="profile" teamId={teamId} style={styles.pageCard} />,
        <TeamLandscape key="landscape" teamId={teamId} style={styles.pageCard} />,
        <PossessionOutcome key="possession" teamId={teamId} style={styles.pageCard} />,
        <BootRoi key="boot" teamId={teamId} style={styles.pageCard} />,
        <RedZoneMatrix key="redzone" teamId={teamId} style={styles.pageCard} />,
        <ScoringRhythm key="rhythm" teamId={teamId} style={styles.pageCard} />,
        <DefensiveIntegrity key="defence" teamId={teamId} style={styles.pageCard} />,
        <SetPieceDiscipline key="setpiece" teamId={teamId} style={styles.pageCard} />,
        <BreakdownTrade key="breakdown" teamId={teamId} style={styles.pageCard} />,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pageCard: {
    flex: 1,
    // Uniform card anchor — same floor as the fixture panes so the
    // Home / team-hub cards stand exactly as tall as Pre-Match's.
    minHeight: PAGE_CARD_MIN_HEIGHT,
  },
});
