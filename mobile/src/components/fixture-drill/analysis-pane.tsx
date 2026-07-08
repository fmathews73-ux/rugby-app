import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
import { ControlConversion } from '@/components/insights/control-conversion';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import {
  MATCH_AXIS_PAIRS,
  MatchAxisH2H,
  MatchGaps,
} from '@/components/insights/match-h2h';
import { ScoringProgression } from '@/components/insights/scoring-progression';
import { Spacing } from '@/constants/theme';
import { useMatchAnalysis } from '@/hooks/use-match-analysis';

// ─── Analysis (Match Analysis) pane ──────────────────────────────────────────

/**
 * Match Analysis pane — flip-card grammar (owner call 2026-07-07),
 * matching Home and Pre-Match: ONE chart carousel where every card
 * carries its narrative on its flip side, fed by the match engine:
 *   Profile → summary · Momentum → momentum · Scoring Progression →
 *   progression · Match Gaps → variance · pairs → their openers
 *   (attackPattern / platform) + axis ¶s · Verdict → verdict.
 *   (Pitch Heatmap removed 2026-07-08 — synthetic heat restated the
 *   territory numbers; revisit with real event coordinates, PRD #34.)
 * The evidence is THIS match's own data: live while the game runs,
 * settled at full-time as the permanent record. The kickoff backdrop
 * lives entirely on Pre-Match.
 */
export function AnalysisPane({ fixture }: { fixture: Fixture }) {
  const carouselRef = useRef<CardCarouselHandle>(null);
  const { data: analysis } = useMatchAnalysis(fixture.id);
  const homeTeam = useTeam(fixture.home_team_id);
  const awayTeam = useTeam(fixture.away_team_id);
  const homeCode = homeTeam.data?.short_name ?? fixture.home_team_id.toUpperCase();
  const awayCode = awayTeam.data?.short_name ?? fixture.away_team_id.toUpperCase();

  const pages = useMemo(() => {
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
        read={analysis?.summary ?? null}
      />,
      // The match story: initiative, then result.
      <CombinedPointsPattern
        key="momentum"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        style={styles.pageCard}
        read={analysis?.momentum ?? null}
      />,
      <ScoringProgression
        key="progression"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        style={styles.pageCard}
        read={analysis?.progression ?? null}
      />,
      // Variance — where the match is being won.
      <MatchGaps
        key="gaps"
        fixture={fixture}
        homeCode={homeCode}
        awayCode={awayCode}
        // Top SEVEN gaps — same cap as the pre-match ladder, so no page
        // outgrows the shared 400pt floor (every axis still renders in
        // full inside its pair card).
        gaps={(analysis?.gaps ?? []).slice(0, 7)}
        style={styles.pageCard}
        read={analysis?.variance ?? null}
      />,
    ];

    for (const pair of MATCH_AXIS_PAIRS) {
      // Pair reads: the pair's opener paragraph (attack-pattern for
      // Attack & Defence, platform for Set Piece & Discipline) ahead of
      // its two axis narratives — same assembly the accordion used.
      const narratives = (analysis?.axes ?? [])
        .filter((ax) => pair.keys.includes(ax.key))
        .map((ax) => ax.narrative);
      const opener =
        pair.title === 'Attack & Defence'
          ? analysis?.attackPattern
          : pair.title === 'Set Piece & Discipline'
            ? analysis?.platform
            : null;
      const paragraphs = [...(opener ? [opener] : []), ...narratives];
      // The territory read that backed the retired heatmap card rides
      // with Kicking & Territory — same subject, one home.
      if (pair.title === 'Kicking & Territory' && analysis?.heatmap) {
        paragraphs.push(analysis.heatmap);
      }
      pages.push(
        <MatchAxisH2H
          key={pair.title}
          pairTitle={pair.title}
          axisKeys={pair.keys}
          fixture={fixture}
          homeCode={homeCode}
          awayCode={awayCode}
          style={styles.pageCard}
          read={paragraphs.length > 0 ? paragraphs.join('\n\n') : null}
        />,
      );
    }

    // Control vs Conversion — the closing verdict chart.
    pages.push(
      <ControlConversion
        key="verdict"
        fixtureId={fixture.id}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        style={styles.pageCard}
        read={analysis?.verdict ?? null}
      />,
    );

    return pages;
  }, [fixture, homeCode, awayCode, analysis]);

  return (
    <View style={styles.analysisPaneStack}>
      {/* Full-screen-width carousel pages escape the drill pane's 24pt
          padding via the negative margin; each page re-applies the card
          column inset internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel ref={carouselRef} pages={pages} />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  analysisPaneStack: { gap: Spacing.three },
  carouselBleed: { marginHorizontal: -Spacing.four },
  // Same viewport-filling floor as the Pre-Match pane — the dots land
  // just above the tab bar, mirroring Home's resting position.
  pageCard: { flex: 1, minHeight: 400 },
});
