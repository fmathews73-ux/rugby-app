import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Fixture, Result } from '@rugby-app/shared';

import { fetchJson } from '@/api/client';
import { useCompetitions, useSeasons, useTeams } from '@/api/hooks';
import { FixtureCarouselCard } from '@/components/fixture-carousel-card';
import { EmptyState, LoadingState } from '@/components/state-views';
import { Colors, Spacing } from '@/constants/theme';
import { formatFixtureDate } from '@/lib/format-fixture-date';

const CARD_GAP = 12;

/**
 * Timeline carousel of 7 fixtures across all competitions.
 *
 * Centre card = the "current" fixture chosen by priority:
 *   1. Any live / half-time match.
 *   2. Otherwise the next scheduled match (kickoff >= now).
 *   3. Otherwise the most recent completed match.
 *
 * The 3 cards to the left of centre are the previous 3 COMPLETED matches;
 * the 3 to the right are the next 3 SCHEDULED matches. Postponed /
 * cancelled fixtures never occupy a slot. Fewer than 7 render near the
 * ends of the season.
 *
 * Horizontal `<ScrollView>` with snap-to-interval + a paged-look dot
 * indicator underneath. No extra deps.
 */
const CARDS_EITHER_SIDE = 3;
export function FixtureCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  // Card width leaves the app-wide 24pt card column on each side,
  // matching the Fixtures / Teams landing pages. Wider than the old
  // 30pt margins, so the completed-fixture `[score][FT][score]` cluster
  // fits with room to spare.
  const CARD_WIDTH = Math.round(screenWidth - Spacing.four * 2);
  const SNAP = CARD_WIDTH + CARD_GAP;
  const SIDE_PAD = Math.round((screenWidth - CARD_WIDTH) / 2);

  const seasons = useSeasons();
  const teams = useTeams();
  const competitions = useCompetitions();

  const seasonIds = useMemo(() => seasons.data?.map((s) => s.id) ?? [], [seasons.data]);

  const fixtureQueries = useQueries({
    queries: seasonIds.map((sid) => ({
      queryKey: ['seasonFixtures', sid],
      queryFn: () => fetchJson<Fixture[]>(`/seasons/${sid}/fixtures`),
    })),
  });

  const allFixtures = useMemo(() => {
    return fixtureQueries
      .flatMap((q) => q.data ?? [])
      .slice()
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  }, [fixtureQueries]);

  // Window composition is BY STATUS, not by list position: the centre
  // card is always the "current" fixture (live if one is on, else the
  // next upcoming kickoff, else the most recent completed as a
  // fallback), flanked by exactly the previous 3 COMPLETED matches on
  // the left and the next 3 SCHEDULED matches on the right. Postponed /
  // cancelled fixtures never occupy a slot.
  const { windowFixtures, centreIndexInWindow } = useMemo(() => {
    if (allFixtures.length === 0) return { windowFixtures: [], centreIndexInWindow: 0 };
    const now = new Date().toISOString();
    const completed = allFixtures.filter((f) => f.status === 'completed');
    const upcoming = allFixtures.filter(
      (f) => f.status === 'scheduled' && f.kickoff_utc >= now,
    );
    const live = allFixtures.find((f) => f.status === 'live' || f.status === 'half-time');

    const centre = live ?? upcoming[0] ?? completed[completed.length - 1];
    if (!centre) return { windowFixtures: [], centreIndexInWindow: 0 };

    const left = completed
      .filter((f) => f.id !== centre.id && f.kickoff_utc < centre.kickoff_utc)
      .slice(-CARDS_EITHER_SIDE);
    const right = upcoming
      .filter((f) => f.id !== centre.id && f.kickoff_utc > centre.kickoff_utc)
      .slice(0, CARDS_EITHER_SIDE);

    return {
      windowFixtures: [...left, centre, ...right],
      centreIndexInWindow: left.length,
    };
  }, [allFixtures]);

  // Fetch results only for fixtures that might have one. Live / half-time
  // fixtures poll every 30 s so the visible carousel score stays fresh
  // without the user having to leave the Home tab.
  const resultQueries = useQueries({
    queries: windowFixtures
      .filter(
        (f) => f.status === 'completed' || f.status === 'live' || f.status === 'half-time',
      )
      .map((f) => ({
        queryKey: ['fixtureResult', f.id],
        queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
        refetchInterval:
          f.status === 'live' || f.status === 'half-time' ? 30_000 : false,
      })),
  });

  const resultByFixture = useMemo(() => {
    const m = new Map<string, Result>();
    for (const q of resultQueries) {
      if (q.data) m.set(q.data.fixture_id, q.data);
    }
    return m;
  }, [resultQueries]);

  const teamById = useMemo(
    () => new Map((teams.data ?? []).map((t) => [t.id, t])),
    [teams.data],
  );
  const compById = useMemo(
    () => new Map((competitions.data ?? []).map((c) => [c.id, c])),
    [competitions.data],
  );

  const [activeIdx, setActiveIdx] = useState(centreIndexInWindow);
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  // Once fixture data has loaded and the window is known, jump the scroll to
  // the centre card. `contentOffset` on ScrollView handles this on iOS at
  // mount but is unreliable on Android — the imperative scrollTo is the
  // belt-and-braces version.
  useEffect(() => {
    if (windowFixtures.length > 0 && !didInitialScroll.current) {
      const targetX = centreIndexInWindow * SNAP;
      // Delay lets layout settle before scrolling.
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: targetX, animated: false });
        setActiveIdx(centreIndexInWindow);
        didInitialScroll.current = true;
      }, 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [windowFixtures.length, centreIndexInWindow, SNAP]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP);
    if (idx !== activeIdx && idx >= 0 && idx < windowFixtures.length) {
      setActiveIdx(idx);
    }
  };

  const isLoading =
    seasons.isLoading ||
    teams.isLoading ||
    competitions.isLoading ||
    fixtureQueries.some((q) => q.isLoading);

  if (isLoading) return <LoadingState label="Loading fixtures…" />;
  if (windowFixtures.length === 0) return <EmptyState label="No fixtures yet." />;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: centreIndexInWindow * SNAP, y: 0 }}>
        {windowFixtures.map((fx, i) => {
          const home = teamById.get(fx.home_team_id);
          const away = teamById.get(fx.away_team_id);
          const comp = compById.get(fx.competition_id);
          const result = resultByFixture.get(fx.id) ?? null;
          return (
            <View
              key={fx.id}
              style={{
                width: CARD_WIDTH,
                marginRight: i === windowFixtures.length - 1 ? 0 : CARD_GAP,
              }}>
              <FixtureCarouselCard
                fixture={fx}
                result={result}
                homeTeam={home}
                awayTeam={away}
                competition={comp}
                dayLabel={formatFixtureDate(fx)}
                width={CARD_WIDTH}
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dotsRow}>
        {windowFixtures.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIdx ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.three,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  dotActive: { backgroundColor: Colors.light.textSecondary },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
  },
});
