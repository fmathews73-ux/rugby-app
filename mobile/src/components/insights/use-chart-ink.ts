import { useContext, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { CarouselPageActiveContext } from '@/components/card-carousel';

/**
 * Chart arrival animation driver — 0→1 as the surrounding carousel
 * page becomes the visible one (or on mount for standalone cards),
 * resetting to 0 when the page swipes away so re-entry re-plays.
 *
 * Drives three motion grammars, all native-driver-only (the JS layout
 * animation route was tried and rejected — jitter):
 * - WIPE: time-axis charts (Momentum, Progression, Form, Ranking,
 *   Rhythm, Danger, Discipline) reveal left-to-right via a sliding
 *   clip window (outer overflow-hidden view translates in, inner
 *   content counter-translates); 2000ms ease-in-out via opts
 * - SWEEP: horizontal fills scaleX from the left edge
 * - FADE: non-temporal position plots (radar, Landscape/Set-Piece
 *   matrix, Possession, Control) opacity in over their static grid
 */
/** Arrival timing — settle delay + sweep duration. Exported so other
 *  arrival-synced cues (the FlipTrigger pulse) can wait for the bars
 *  and count-ups to finish. */
export const CHART_INK_DELAY_MS = 250;
export const CHART_INK_DURATION_MS = 1100;
export const CHART_INK_TOTAL_MS = CHART_INK_DELAY_MS + CHART_INK_DURATION_MS;

/**
 * @param replayKey When this value changes (e.g. a team toggle flips,
 * swapping the card's dataset), the arrival animation resets and
 * replays so bars re-sweep and count-ups re-count for the new data.
 * @param opts Timing overrides — the timeline wipes (Momentum,
 * Progression) run a longer ease-in-out sweep; driver-level easing is
 * native-driver-safe (per-interpolation easing is NOT).
 */
export function useChartInk(
  replayKey?: unknown,
  opts?: { duration?: number; easing?: (value: number) => number },
): Animated.Value {
  const ink = useRef(new Animated.Value(0)).current;
  const pageActive = useContext(CarouselPageActiveContext);

  useEffect(() => {
    if (!pageActive) {
      ink.setValue(0);
      return;
    }
    ink.setValue(0);
    const anim = Animated.timing(ink, {
      toValue: 1,
      duration: opts?.duration ?? CHART_INK_DURATION_MS,
      delay: CHART_INK_DELAY_MS,
      easing: opts?.easing ?? Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // opts is intentionally not a dependency — call sites pass literals.
  }, [pageActive, ink, replayKey]);

  return ink;
}
