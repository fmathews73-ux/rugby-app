import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { PreMatchAnalysisCard } from '@/components/fixture-drill/pre-match-analysis-card';
import { AxisHeadToHead } from '@/components/insights/axis-head-to-head';
import { DangerWindows } from '@/components/insights/danger-windows';
import { GapLadder } from '@/components/insights/gap-ladder';
import { InsightsCanvas } from '@/components/insights/insights-canvas';
import { Spacing } from '@/constants/theme';
import { useMatchPreview, type PreviewAxisKey } from '@/hooks/use-match-preview';
import { PRE_MATCH_AXIS_PAIRS } from '@/lib/analysis-section-info';

// ─── Preview (Pre-Match) pane ────────────────────────────────────────────────

// Engine window — matches use-match-preview's WINDOW.
const LOOKBACK = 10;

/**
 * Pre-Match pane — the app's surface grammar, STRICT 1:1: one section
 * per carousel card, labels identical to card titles (Shape + Keys
 * write one 'Profile H2H' section — they always read the same chart).
 * Two-way sync: opening a section slides its chart in; swiping opens
 * the matching section. Every page is frozen as of kickoff, so the
 * pane persists as a true pre-match document after full-time.
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
   *  the day of the fixture. */
  asOfDate: string;
}) {
  const carouselRef = useRef<CardCarouselHandle>(null);
  const [section, setSection] = useState('__summary__');
  const { data } = useMatchPreview(fixture.id);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);
  const homeCode = homeTeam.data?.short_name ?? homeTeamId.toUpperCase();
  const awayCode = awayTeam.data?.short_name ?? awayTeamId.toUpperCase();

  // Section ↔ page maps, built from the preview data so the axis order
  // and the conditional Danger page always match the card's sections.
  const { pages, sectionPage, pageSection } = useMemo(() => {
    const pages: React.ReactNode[] = [
      // No fixtureStatus here on purpose: that gate ("populates once
      // under way") belongs to the Insights pane, where the radar is
      // match-scoped. Pre-match reads the HISTORICAL prev-10 profile
      // frozen at kickoff — it must render for scheduled fixtures;
      // in-match reads live one pill over, on Analysis.
      <InsightsCanvas
        key="radar"
        primaryTeamId={homeTeamId}
        compareTeamId={awayTeamId}
        asOfDate={asOfDate}
        lookback={LOOKBACK}
        style={styles.pageCard}
      />,
      <GapLadder
        key="ladder"
        gaps={data?.gaps ?? []}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeCode={homeCode}
        awayCode={awayCode}
        asOfDate={asOfDate}
        style={styles.pageCard}
      />,
    ];
    // STRICT 1:1 — Shape/Keys merged into the 'Profile H2H' section
    // (the card's own title); Danger relabelled to its card title.
    const sectionPage: Record<string, number> = { __summary__: 0, 'Profile H2H': 1 };
    const pageSection: string[] = ['__summary__', 'Profile H2H'];

    if (data) {
      for (const pair of PRE_MATCH_AXIS_PAIRS) {
        sectionPage[pair.title] = pages.length;
        pageSection.push(pair.title);
        pages.push(
          <AxisHeadToHead
            key={pair.title}
            axisKeys={pair.keys as readonly PreviewAxisKey[]}
            title={pair.title}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            homeCode={homeCode}
            awayCode={awayCode}
            asOfDate={asOfDate}
            style={styles.pageCard}
          />,
        );
      }
    }

    if (data?.danger) {
      sectionPage['Danger Windows'] = pages.length;
      pageSection.push('Danger Windows');
      pages.push(
        <DangerWindows
          key="danger"
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeCode={homeCode}
          awayCode={awayCode}
          asOfDate={asOfDate}
          style={styles.pageCard}
        />,
      );
    }

    return { pages, sectionPage, pageSection };
  }, [data, homeTeamId, awayTeamId, homeCode, awayCode, asOfDate]);

  return (
    <View style={styles.insightsPaneStack}>
      {/* Full-screen-width carousel pages need to escape the drill
          pane's 24pt horizontal padding — the negative margin bleeds
          the carousel back to the screen edges; each page re-applies
          the card column inset internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel
          ref={carouselRef}
          onPageChange={(i) => setSection(pageSection[i] ?? '__summary__')}
          pages={pages}
        />
      </View>

      {/* The written pre-match read — what the charts above amount to.
          Opening a section slides its evidence into view; swiping the
          carousel opens the matching section. */}
      <PreMatchAnalysisCard
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
  insightsPaneStack: { gap: Spacing.three },
  carouselBleed: { marginHorizontal: -Spacing.four },
  pageCard: { flex: 1 },
});
