import { useEffect, useRef, useState } from 'react';
import type { Animated } from 'react-native';
import { TSpan } from 'react-native-svg';

/**
 * Progressive count synced to the arrival sweep: listens to the same
 * `ink` value driving a bar's scale transform, so the digits climb
 * from 0 and decelerate into the final number exactly as the bar
 * lands. Decimal places mirror the formatted target ("22.4" counts in
 * tenths, "85" in wholes). Text content can't ride the native driver,
 * so this is a JS-side listener — but it only re-renders its own Text
 * node.
 */
export function CountUpValue({ value, ink }: { value: string; ink: Animated.Value }) {
  const target = Number.parseFloat(value);
  const decimals = value.split('.')[1]?.length ?? 0;
  const [shown, setShown] = useState(() => (0).toFixed(decimals));
  // Last driver value seen — so a target change (toggle flip) can
  // re-derive the display immediately instead of showing stale digits
  // until the next animation frame.
  const last = useRef(0);

  useEffect(() => {
    setShown((target * last.current).toFixed(decimals));
    const id = ink.addListener(({ value: v }) => {
      last.current = Math.min(Math.max(v, 0), 1);
      setShown((target * last.current).toFixed(decimals));
    });
    return () => ink.removeListener(id);
  }, [ink, target, decimals]);

  return <>{shown}</>;
}

/**
 * SVG sibling of CountUpValue — react-native-svg's Text ignores
 * nested non-SVG components, so badge values count up through a
 * TSpan, which inherits the parent SvgText's fill/font attributes.
 */
export function CountUpTSpan({ value, ink }: { value: string; ink: Animated.Value }) {
  const target = Number.parseFloat(value);
  const decimals = value.split('.')[1]?.length ?? 0;
  const [shown, setShown] = useState(() => (0).toFixed(decimals));
  const last = useRef(0);

  useEffect(() => {
    setShown((target * last.current).toFixed(decimals));
    const id = ink.addListener(({ value: v }) => {
      last.current = Math.min(Math.max(v, 0), 1);
      setShown((target * last.current).toFixed(decimals));
    });
    return () => ink.removeListener(id);
  }, [ink, target, decimals]);

  return <TSpan>{shown}</TSpan>;
}
