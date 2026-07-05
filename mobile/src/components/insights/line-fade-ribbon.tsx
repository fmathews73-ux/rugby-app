import { Path } from 'react-native-svg';

/**
 * Contour-hugging fade beneath a line chart — the GA-style "short
 * distance below the line" fill. Renders a stack of echo copies of the
 * line path, each translated a few px further down with decaying
 * opacity, so the tint follows the LINE's shape everywhere instead of
 * filling down to the axis. Works with any stroke, including gradient
 * urls, so outcome-coloured lines get matching outcome-coloured fades.
 *
 * Callers should wrap this in a <G clipPath=...> bounded to the plot
 * area so the lowest echoes never spill into axis labels.
 */
export function LineFadeRibbon({
  path,
  stroke,
  steps = 8,
  stepPx = 3,
  strokeWidth = 3.2,
  baseOpacity = 0.12,
}: {
  /** The line's SVG path `d` — the same one the visible stroke uses. */
  path: string;
  /** Stroke paint — a colour or a gradient url(#id). */
  stroke: string;
  /** Number of echo copies. */
  steps?: number;
  /** Vertical offset between copies — steps × stepPx = band height. */
  stepPx?: number;
  /** Echo stroke width — slightly above stepPx so copies overlap into
   *  a continuous band instead of visible banding. */
  strokeWidth?: number;
  /** Opacity of the first echo; the rest decay from here. */
  baseOpacity?: number;
}) {
  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / (steps + 1);
        return (
          <Path
            key={i}
            d={path}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            opacity={baseOpacity * Math.pow(1 - t, 1.5)}
            transform={`translate(0, ${(i + 1) * stepPx})`}
          />
        );
      })}
    </>
  );
}
