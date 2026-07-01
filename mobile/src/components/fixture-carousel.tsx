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
import { Spacing } from '@/constants/theme';

const ACCENT = '#4F46E5';
const CARD_GAP = 12;

/**
 * Timeline carousel of 5 fixtures across all competitions.
 *
 * Centre card = the "current" fixture chosen by priority:
 *   1. Any live / half-time match.
 *   2. Otherwise the next scheduled match (kickoff >= now).
 *   3. Otherwise the most recent completed match.
 *
 * The 2 cards to the left of centre are the two immediately-preceding
 * fixtures in chronological order; the 2 to the right are the next two.
 * Fewer than 5 render if the window is at the ends of the sorted list.
 *
 * Horizontal `<ScrollView>` with snap-to-interval + a paged-look dot
 * indicator underneath. No extra deps.
 */
export function FixtureCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = Math.round(screenWidth - 80);
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

  const currentIdx = useMemo(() => {
    if (allFixtures.length === 0) return -1;
    const now = new Date().toISOString();
    // 1. live / half-time
    const liveIdx = allFixtures.findIndex(
      (f) => f.status === 'live' || f.status === 'half-time',
    );
    if (liveIdx !== -1) return liveIdx;
    // 2. next scheduled at or after now
    const nextIdx = allFixtures.findIndex(
      (f) => f.status === 'scheduled' && f.kickoff_utc >= now,
    );
    if (nextIdx !== -1) return nextIdx;
    // 3. last completed
    let lastCompleted = -1;
    for (let i = 0; i < allFixtures.length; i++) {
      const f = allFixtures[i];
      if (f && f.status === 'completed') lastCompleted = i;
    }
    return lastCompleted;
  }, [allFixtures]);

  const windowFixtures = useMemo(() => {
    if (currentIdx === -1 || allFixtures.length === 0) return [];
    const start = Math.max(0, currentIdx - 2);
    const end = Math.min(allFixtures.length, currentIdx + 3);
    return allFixtures.slice(start, end);
  }, [allFixtures, currentIdx]);

  // Where in the window is the centre / current fixture?
  const centreIndexInWindow = useMemo(() => {
    if (currentIdx === -1) return 0;
    return currentIdx - Math.max(0, currentIdx - 2);
  }, [currentIdx]);

  // Fetch results only for fixtures that might have one.
  const resultQueries = useQueries({
    queries: windowFixtures
      .filter(
        (f) => f.status === 'completed' || f.status === 'live' || f.status === 'half-time',
      )
      .map((f) => ({
        queryKey: ['fixtureResult', f.id],
        queryFn: () => fetchJson<Result>(`/fixtures/${f.id}/result`),
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
                dayLabel={formatDayLabel(fx.kickoff_utc)}
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

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.three,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotActive: { backgroundColor: ACCENT },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
});
