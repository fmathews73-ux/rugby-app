import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { GapLadder } from '@/components/insights/gap-ladder';
import { MatchPairMatrix } from '@/components/insights/match-pair-matrix';
import { fitNarrative } from '@/lib/fit-narrative';
import { CombinedPointsPattern } from '@/components/insights/combined-points-pattern';
import { ControlConversion } from '@/components/insights/control-conversion';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import {
  MATCH_AXIS_PAIRS,
  MatchAxisH2H,
} from '@/components/insights/match-h2h';
import { ScoringProgression } from '@/components/insights/scoring-progression';
import { PAGE_CARD_MIN_HEIGHT, Spacing } from '@/constants/theme';
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
      // Summary — the head-to-head radar built from THIS match's
      // Result (owner call 2026-07-09); the coming-in version lives on
      // Pre-Match.
      <InsightsCanvas
        key="radar"
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        fixtureStatus={fixture.status}
        fixtureId={fixture.id}
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
      // The familiar matrix lens, fed by THIS MATCH's numbers and
      // framed pair-relative (owner semantics 2026-07-09): crosshairs
      // at the pair's midpoints, dots from the Result — the real-time
      // compare-and-contrast to Pre-Match's coming-in versions.
      <MatchPairMatrix
        key="landscape"
        fixture={fixture}
        title="Landscape"
        purpose="This match’s control map: possession share against territory share, each side framed against the other — whoever holds the top-right is winning both the ball and the field tonight."
        accessibilityLabel="Explain the match landscape matrix"
        getAxes={(r, side) => ({
          x: side === 'home' ? r.home_possession_percent : r.away_possession_percent,
          y: side === 'home' ? r.home_territory_percent : r.away_territory_percent,
        })}
        quadrants={{ tr: 'CONTROLLERS', tl: 'KICK-FIRST', br: 'KEEP-BALL', bl: 'STARVED' }}
        xCaption="POSSESSION % →"
        yCaption="TERRITORY % →"
        xUnit="%"
        yUnit="%"
        style={styles.pageCard}
      />,
      <MatchPairMatrix
        key="rhythm"
        fixture={fixture}
        title="Rhythm"
        purpose="When this match’s points came: first-half scoring against second-half scoring, each side framed against the other. Dot positions settle at full-time."
        accessibilityLabel="Explain the match rhythm matrix"
        getAxes={(r, side) => {
          const ht = side === 'home' ? r.half_time_home : r.half_time_away;
          const ft = side === 'home' ? r.home_score : r.away_score;
          return { x: ht, y: ft - ht };
        }}
        quadrants={{ tr: 'FULL EIGHTY', tl: 'SLOW BURNERS', br: 'FAST STARTERS', bl: 'MISFIRING' }}
        xCaption="1ST-HALF POINTS →"
        yCaption="2ND-HALF POINTS →"
        style={styles.pageCard}
      />,
      <MatchPairMatrix
        key="redzone"
        fixture={fixture}
        title="Red Zone"
        purpose="This match’s red-zone ledger: 22 entries against the points each entry paid, each side framed against the other."
        accessibilityLabel="Explain the match red-zone matrix"
        getAxes={(r, side) => {
          const entries = side === 'home' ? r.home_twenty_two_entries : r.away_twenty_two_entries;
          const pts =
            side === 'home'
              ? r.home_points_from_twenty_two_entries
              : r.away_points_from_twenty_two_entries;
          return { x: entries, y: entries > 0 ? pts / entries : 0 };
        }}
        quadrants={{ tr: 'RELENTLESS', tl: 'CLINICAL', br: 'WASTEFUL', bl: 'BLUNT' }}
        xCaption="22 ENTRIES →"
        yCaption="POINTS PER ENTRY →"
        style={styles.pageCard}
      />,
      <MatchPairMatrix
        key="defence"
        fixture={fixture}
        title="Defence"
        purpose="This match’s line integrity: tackle completion against line breaks conceded (the opponent’s breaks — derived, never stored), each side framed against the other."
        accessibilityLabel="Explain the match defence matrix"
        getAxes={(r, side) => ({
          x: side === 'home' ? r.home_tackle_success_percent : r.away_tackle_success_percent,
          // Breaks conceded = the opponent's breaks (reconciliation
          // principle); lower-is-better, so it feeds RAW
          // (yHigherIsBetter=false) — the chart plots smaller y higher.
          y: side === 'home' ? r.away_line_breaks : r.home_line_breaks,
        })}
        yHigherIsBetter={false}
        quadrants={{ tr: 'THE WALL', tl: 'SCRAMBLERS', br: 'OUT OF SHAPE', bl: 'BROKEN OPEN' }}
        xCaption="TACKLE SUCCESS % →"
        yCaption="FEWER BREAKS CONCEDED →"
        xUnit="%"
        style={styles.pageCard}
      />,
      // H2H ladder fed by THIS match's Result (owner call 2026-07-09,
      // superseding the coming-in repeat: a per-game 21.2 next to a
      // match score read as a bug). Same seven rungs as Pre-Match.
      // About-only back: the pre-match shape/keys narrative describes
      // the coming-in gaps, not these bars.
      <GapLadder
        key="ladder"
        gaps={[]}
        fixture={fixture}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeCode={homeCode}
        awayCode={awayCode}
        style={styles.pageCard}
      />,
    ];

    for (const pair of MATCH_AXIS_PAIRS) {
      // Pair reads: the pair's opener paragraph (attack-pattern for
      // Attack & Defence, platform for Set-Piece & Discipline) ahead of
      // its two axis narratives — same assembly the accordion used.
      const narratives = (analysis?.axes ?? [])
        .filter((ax) => pair.keys.includes(ax.key))
        .map((ax) => ax.narrative);
      const opener =
        pair.title === 'Attack & Defence'
          ? analysis?.attackPattern
          : pair.title === 'Set-Piece & Discipline'
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
          read={paragraphs.length > 0 ? fitNarrative(paragraphs, 900) : undefined}
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
  pageCard: { flex: 1, minHeight: PAGE_CARD_MIN_HEIGHT },
});
