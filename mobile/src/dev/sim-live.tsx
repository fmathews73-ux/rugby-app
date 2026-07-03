import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Fixture, MatchEvent, Result } from '@rugby-app/shared';

/**
 * Dev-only "synthetic live match" simulator.
 *
 * Rugby matches don't exist in a `live` state anywhere in the synthetic
 * dev dataset (every generated fixture is `scheduled` or `completed`).
 * Without a simulator, there's no visual way to verify:
 *   • the 30 s poll cadence wired via `useFixture` / `useFixtureResult`
 *     / `useFixtureEvents`
 *   • the Scoring Progression worm chart growing along the x-axis as
 *     events land
 *   • Momentum arc / Pitch Heatmap / Stats bars re-rendering with fresh
 *     data on each refetch
 *   • hero-header LIVE pill + pulsing dot
 *
 * The simulator picks one completed fixture and virtually "rewinds" it
 * to minute 0, then advances a virtual clock at a configurable speedup
 * so the whole 80-minute story plays out in ~10 real minutes. Data
 * transformation happens client-side via `select` transformers on the
 * fixture-scoped hooks — no server round-trip needed.
 *
 * Gated by `__DEV__` at the UI level (see `SimLiveToggle`); safe to
 * ship because the provider defaults to inactive and no code path
 * enables it in a production build.
 *
 * See [[project-rugby-app]] for the live-refresh polling design that
 * this simulator exists to smoke-test.
 */

// 8× real speed: 80 virtual mins in ~10 real mins. Tunable — too fast
// makes the sim hard to observe; too slow wastes time.
const VIRTUAL_MINUTES_PER_REAL_SECOND = 8 / 60;
// Clock advances in real time; state re-emits every 3 s so React
// re-renders (and `select` transformers re-derive) at that cadence.
const TICK_INTERVAL_MS = 3_000;

interface SimLiveState {
  active: boolean;
  fixtureId: string | null;
  virtualMinute: number;
  startedAt: number | null;
}

interface SimLiveApi extends SimLiveState {
  start: (fixtureId: string) => void;
  stop: () => void;
}

const initialState: SimLiveState = {
  active: false,
  fixtureId: null,
  virtualMinute: 0,
  startedAt: null,
};

const SimLiveContext = createContext<SimLiveApi | null>(null);

export function SimLiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimLiveState>(initialState);
  const startedAtRef = useRef<number | null>(null);
  const fixtureIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.active) return;
    const timer = setInterval(() => {
      if (!startedAtRef.current) return;
      const realElapsedSec = (Date.now() - startedAtRef.current) / 1000;
      const vMin = Math.min(80, realElapsedSec * VIRTUAL_MINUTES_PER_REAL_SECOND);
      setState((s) =>
        s.fixtureId === fixtureIdRef.current
          ? { ...s, virtualMinute: vMin }
          : s,
      );
    }, TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.active]);

  const api = useMemo<SimLiveApi>(
    () => ({
      ...state,
      start: (fixtureId: string) => {
        startedAtRef.current = Date.now();
        fixtureIdRef.current = fixtureId;
        setState({
          active: true,
          fixtureId,
          virtualMinute: 0,
          startedAt: Date.now(),
        });
      },
      stop: () => {
        startedAtRef.current = null;
        fixtureIdRef.current = null;
        setState(initialState);
      },
    }),
    [state],
  );

  return <SimLiveContext.Provider value={api}>{children}</SimLiveContext.Provider>;
}

/** Read + control the sim-live state. */
export function useSimLive(): SimLiveApi {
  const ctx = useContext(SimLiveContext);
  if (!ctx) {
    // Safe fallback when provider isn't mounted — always returns "inactive"
    // so transformers pass data through unchanged. Lets the hook run in
    // isolation without requiring the provider (e.g. in a test).
    return {
      ...initialState,
      start: () => {},
      stop: () => {},
    };
  }
  return ctx;
}

// ─── Transformers ────────────────────────────────────────────────────────────
//
// Each transformer runs inside the corresponding query's `select` callback,
// so they receive raw completed-fixture data and return the "as-of virtual
// minute" slice. Called on every render; must be pure + cheap.

/** Overrides status to `'live'` for the targeted fixture. Other fields pass
 *  through unchanged. */
export function transformFixtureForSim(
  sim: SimLiveApi,
  fixture: Fixture | undefined,
): Fixture | undefined {
  if (!sim.active || !fixture || sim.fixtureId !== fixture.id) return fixture;
  return { ...fixture, status: 'live' };
}

/**
 * Rebuilds `Result` against the current virtual clock. Score-related
 * fields (scores, try counts, conversion counts, penalty-goal counts,
 * drop-goal counts, half-time snapshot, card counts) are DERIVED from
 * the event stream so they match what a real live feed would emit —
 * i.e. `home_score` = sum of `points` on this team's scoring events
 * where `minute ≤ vMin`. Every other numeric aggregate (metres,
 * tackles, carries, kicks, penalties conceded, etc.) is scaled
 * proportionally by `vMin / 80` since we can't derive those from the
 * event stream alone. Percentages pass through unchanged.
 *
 * Requires the fixture (for `home_team_id` / `away_team_id`) and the
 * already-sim-filtered events to compute the derived fields.
 */
export function transformResultForSim(
  sim: SimLiveApi,
  fixtureId: string,
  result: Result | undefined,
  events: readonly MatchEvent[] | undefined,
  fixture: Fixture | undefined,
): Result | undefined {
  if (!sim.active || !result || sim.fixtureId !== fixtureId) return result;

  // If the fixture or events aren't loaded yet, fall back to proportional
  // scaling so we still render *something* rather than raw completed data.
  // Once both queries land, the next render swaps to the accurate path.
  if (!events || !fixture) return scaleResultProportionally(result, sim.virtualMinute);

  const homeId = fixture.home_team_id;
  const awayId = fixture.away_team_id;

  const forTeam = (teamId: string) => events.filter((e) => e.team_id === teamId);
  const sumPoints = (list: readonly MatchEvent[]) =>
    list.reduce((s, e) => s + (e.points > 0 ? e.points : 0), 0);
  const countByType = (list: readonly MatchEvent[], type: MatchEvent['type']) =>
    list.filter((e) => e.type === type).length;

  const homeEvents = forTeam(homeId);
  const awayEvents = forTeam(awayId);

  const homeFirstHalf = homeEvents.filter((e) => e.minute < 40);
  const awayFirstHalf = awayEvents.filter((e) => e.minute < 40);

  // Proportional scaling for everything not derived from events.
  const scaled = scaleResultProportionally(result, sim.virtualMinute);

  // Override the derivable fields with event-summed values so the scores
  // and category counts match what a real live feed would emit.
  return {
    ...scaled,
    home_score: sumPoints(homeEvents),
    away_score: sumPoints(awayEvents),
    home_tries: countByType(homeEvents, 'try'),
    away_tries: countByType(awayEvents, 'try'),
    home_conversions: countByType(homeEvents, 'conversion'),
    away_conversions: countByType(awayEvents, 'conversion'),
    home_penalties: countByType(homeEvents, 'penalty-goal'),
    away_penalties: countByType(awayEvents, 'penalty-goal'),
    home_drop_goals: countByType(homeEvents, 'drop-goal'),
    away_drop_goals: countByType(awayEvents, 'drop-goal'),
    // Half-time score only populates once the virtual clock has crossed 40.
    half_time_home: sim.virtualMinute >= 40 ? sumPoints(homeFirstHalf) : 0,
    half_time_away: sim.virtualMinute >= 40 ? sumPoints(awayFirstHalf) : 0,
    home_yellow_cards: countByType(homeEvents, 'yellow-card'),
    away_yellow_cards: countByType(awayEvents, 'yellow-card'),
    home_red_cards: countByType(homeEvents, 'red-card'),
    away_red_cards: countByType(awayEvents, 'red-card'),
  } as Result;
}

function scaleResultProportionally(result: Result, virtualMinute: number): Result {
  const scale = Math.min(1, virtualMinute / 80);
  const isPercent = (k: string) =>
    k.endsWith('_percent') || k.endsWith('percent');
  const isHalfTime = (k: string) => k.startsWith('half_time');
  const preserved = new Set(['fixture_id']);

  const out: Record<string, unknown> = { ...result };
  for (const [key, value] of Object.entries(result)) {
    if (preserved.has(key)) continue;
    if (typeof value !== 'number') continue;
    if (isPercent(key)) continue;
    if (isHalfTime(key)) {
      out[key] = virtualMinute >= 40 ? value : 0;
      continue;
    }
    out[key] = Math.round(value * scale);
  }
  return out as Result;
}

/** Filters events to those that would have happened by the current
 *  virtual minute. Milestones (kick-off, half-time, full-time) are
 *  emitted based on the virtual clock rather than the raw event stream:
 *  kick-off always shows, half-time when virtualMinute ≥ 40, full-time
 *  when ≥ 80. */
export function transformEventsForSim(
  sim: SimLiveApi,
  fixtureId: string,
  events: readonly MatchEvent[] | undefined,
): MatchEvent[] | undefined {
  if (!sim.active || !events || sim.fixtureId !== fixtureId) {
    return events as MatchEvent[] | undefined;
  }
  const vMin = sim.virtualMinute;
  return events.filter((e) => {
    if (e.type === 'full-time') return vMin >= 80;
    if (e.type === 'half-time') return vMin >= 40;
    if (e.type === 'second-half-start') return vMin >= 40;
    if (e.type === 'kick-off') return true;
    // Everything else — actual gameplay events — gates on the event's own
    // minute stamp so the timeline reveals in real order.
    return e.minute <= vMin;
  });
}
