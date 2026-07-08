import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fixture } from '@rugby-app/shared';

import { useTeam } from '@/api/hooks';
import { CardCarousel, type CardCarouselHandle } from '@/components/card-carousel';
import { fitNarrative } from '@/lib/fit-narrative';
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
 * Pre-Match pane — flip-card grammar (owner call 2026-07-07): ONE chart
 * carousel where every card carries its narrative on its flip side.
 * The old Pre-Match Analysis accordion + two-way sync is gone; each
 * card's reader icon flips to WHAT THIS SHOWS + THE READ, fed by the
 * same as-of-kickoff engine fields the accordion used:
 *   Profile → summary · Profile H2H → shape + keys · axis pairs →
 *   their two axis narratives · Danger Windows → danger.
 * Every page is frozen as of kickoff, so the pane persists as a true
 * pre-match document after full-time.
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
  const { data } = useMatchPreview(fixture.id);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);
  const homeCode = homeTeam.data?.short_name ?? homeTeamId.toUpperCase();
  const awayCode = awayTeam.data?.short_name ?? awayTeamId.toUpperCase();

  const pages = useMemo(() => {
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
        read={data?.summary ?? null}
      />,
      // One ladder card, top SEVEN gaps (the card's height fits 7
      // bars). The eighth — the least-differentiating axis — isn't
      // lost: every axis also renders in its axis-pair card below.
      <GapLadder
        key="ladder"
        gaps={(data?.gaps ?? []).slice(0, 7)}
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeCode={homeCode}
        awayCode={awayCode}
        asOfDate={asOfDate}
        style={styles.pageCard}
        read={data ? fitNarrative([data.shape, data.keys], 900) : null}
      />,
    ];

    if (data) {
      for (const pair of PRE_MATCH_AXIS_PAIRS) {
        const narratives = pair.keys
          .map((k) => data.axes.find((ax) => ax.key === k)?.narrative)
          .filter((n): n is string => Boolean(n));
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
            read={fitNarrative(narratives, 900)}
          />,
        );
      }
    }

    if (data?.danger) {
      pages.push(
        <DangerWindows
          key="danger"
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeCode={homeCode}
          awayCode={awayCode}
          asOfDate={asOfDate}
          style={styles.pageCard}
          read={data.danger}
        />,
      );
    }

    return pages;
  }, [data, homeTeamId, awayTeamId, homeCode, awayCode, asOfDate]);

  return (
    <View style={styles.insightsPaneStack}>
      {/* Full-screen-width carousel pages need to escape the drill
          pane's 24pt horizontal padding — the negative margin bleeds
          the carousel back to the screen edges; each page re-applies
          the card column inset internally. */}
      <View style={styles.carouselBleed}>
        <CardCarousel ref={carouselRef} pages={pages} />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  insightsPaneStack: { gap: Spacing.three },
  carouselBleed: { marginHorizontal: -Spacing.four },
  // Taller than natural content: fills the drill viewport so the
  // carousel dots land just above the tab bar, mirroring Home's
  // resting position. Tune this number against the device.
  pageCard: { flex: 1, minHeight: 400 },
});
