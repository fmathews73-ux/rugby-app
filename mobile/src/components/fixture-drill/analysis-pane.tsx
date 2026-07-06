import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
import { ControlConversion } from '@/components/insights/control-conversion';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { PitchHeatmap } from '@/components/insights/pitch-heatmap';
import {
  MATCH_AXIS_PAIRS,
  MatchAxisH2H,
  MatchGaps,
} from '@/components/insights/match-h2h';
import { ScoringProgression } from '@/components/insights/scoring-progression';
import { MatchAnalysisCard } from '@/components/match-analysis-card';
import { Spacing } from '@/constants/theme';
import { useMatchAnalysis } from '@/hooks/use-match-analysis';

// ─── Analysis (Match Analysis) pane ──────────────────────────────────────────

/**
 * Match Analysis pane — same surface grammar as Pre-Match (ONE chart
 * carousel + ONE analysis accordion, two-way synced), but the evidence
 * is THIS match's own data: live while the game runs, settled at
 * full-time as the permanent record. Nothing here reads history — the
 * kickoff backdrop lives entirely on the Pre-Match pill, keeping the
 * two surfaces cleanly split: known-at-kickoff vs the match itself.
 */
export function AnalysisPane({ fixture }: { fixture: Fixture }) {
  const carouselRef = useRef<CardCarouselHandle>(null);
  const [section, setSection] = useState('__summary__');
  const { data: analysis } = useMatchAnalysis(fixture.id);
  const homeTeam = useTeam(fixture.home_team_id);
  const awayTeam = useTeam(fixture.away_team_id);
  const homeCode = homeTeam.data?.short_name ?? fixture.home_team_id.toUpperCase();
  const awayCode = awayTeam.data?.short_name ?? fixture.away_team_id.toUpperCase();

  const { pages, sectionPage, pageSection } = useMemo(() => {
    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;

    const pages: React.ReactNode[] = [
      // Summary — the match-scoped head-to-head radar.
      <InsightsCanvas
        key="radar"
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        style={styles.pageCard}
      />,
      // Commentary — the match story: initiative, then result. The
      // Insights trio (Profile, Momentum, Progression) opens the deck
      // back to back; the kickoff backdrop lives on Pre-Match, where it
      // belongs — this pane is strictly the match itself.
      <CombinedPointsPattern
        key="momentum"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        style={styles.pageCard}
      />,
      <ScoringProgression
        key="progression"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        style={styles.pageCard}
      />,
      // Variance — where the match is being won.
      <MatchGaps
        key="gaps"
        fixture={fixture}
        homeCode={homeCode}
        awayCode={awayCode}
        gaps={analysis?.gaps ?? []}
        style={styles.pageCard}
      />,
    ];
    const sectionPage: Record<string, number> = {
      __summary__: 0,
      Commentary: 1,
      Variance: 3,
    };
    // Progression (page 2) belongs to Commentary too — swiping onto it
    // keeps the Commentary section open.
    const pageSection: string[] = ['__summary__', 'Commentary', 'Commentary', 'Variance'];

    for (const pair of MATCH_AXIS_PAIRS) {
      sectionPage[pair.title] = pages.length;
      pageSection.push(pair.title);
      pages.push(
        <MatchAxisH2H
          key={pair.title}
          pairTitle={pair.title}
          axisKeys={pair.keys}
          fixture={fixture}
          homeCode={homeCode}
          awayCode={awayCode}
          style={styles.pageCard}
        />,
      );
      if (pair.title === 'Kicking & Territory') {
        // The heatmap is territory made visible — it rides as this
        // section's second page (rehomed from the retired Insights
        // pill), same pattern as Progression riding with Commentary.
        pageSection.push(pair.title);
        pages.push(
          <PitchHeatmap
            key="heatmap"
            fixtureId={fixture.id}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            fixtureStatus={fixture.status}
            style={styles.pageCard}
          />,
        );
      }
    }

    // Verdict — the closing chart: control into points.
    sectionPage.Verdict = pages.length;
    pageSection.push('Verdict');
    pages.push(
      <ControlConversion
        key="verdict"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        style={styles.pageCard}
      />,
    );

    return { pages, sectionPage, pageSection };
  }, [fixture, homeCode, awayCode, analysis?.gaps]);

  return (
    <View style={styles.analysisPaneStack}>
      {/* Full-screen-width carousel pages escape the drill pane's 24pt
          padding via the negative margin; each page re-applies the card
          column inset internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel
          ref={carouselRef}
          onPageChange={(i) => setSection(pageSection[i] ?? '__summary__')}
          pages={pages}
        />
      </View>

      {/* The written match read — what the charts above amount to.
          Opening a section slides its evidence into view; swiping the
          carousel opens the matching section. */}
      <MatchAnalysisCard
        fixture={fixture}
        openSection={section}
        onOpenSection={(next) => {
          setSection(next);
          const page = sectionPage[next];
          if (page !== undefined) carouselRef.current?.scrollToPage(page);
        }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  analysisPaneStack: { gap: Spacing.three },
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
});
