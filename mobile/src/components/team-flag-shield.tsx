import Svg, { ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';

// Exact geometry extracted from the owner-licensed reference vector
// (shutterstock_1166737669.eps, parsed 2026-07-07): the outer sticker
// silhouette and the inner flag boundary, in the artwork's own
// coordinate space. The licensed asset supplies the shape; flags
// remain flagcdn sources (no crests — register #28).
const OUTER_W = 203.56;
const OUTER_H = 225.07;
const OUTER_PATH =
  'M3.74 194.29 C19.5 200.75 35.49 206.53 51.65 211.69 C67.83 216.82 84.1 221.27 100.4 225.07 L103.07 225.07 C120.27 221.13 136.86 216.57 152.9 211.49 C168.83 206.45 184.45 200.75 199.81 194.46 L203.56 192.93 L203.56 188.93 L203.56 93.68 C203.56 43.14 164.01 26.42 116.5 6.35 C113.61 5.13 110.64 3.88 104.0 1.02 L101.62 0.0 L99.21 1.08 C95.41 2.78 91.11 4.65 86.83 6.52 C42.07 26.13 0.0 44.53 0.0 91.73 L0.0 188.76 L0.0 192.76 L3.74 194.29';

// NOTE: in these raw (y-flipped-from-PostScript) coordinates the
// rounded POINT sits at y=0 and the peaked edge at y=OUTER_H; the
// render group flips vertically so the peak lands at the top, exactly
// as in the reference.
const INNER_W = 179.57;
const INNER_H = 200.01;
const INNER_X = 12.0; // (OUTER_W - INNER_W) / 2 — symmetric side band
const INNER_Y = 13.0; // band above the point; ≈12.06 above the peak
const INNER_PATH =
  'M43.26 187.23 C28.77 182.61 14.34 177.42 0.0 171.67 L0.0 78.66 C0.0 39.29 38.58 22.39 79.63 4.42 C82.89 3.0 86.17 1.56 89.69 0.0 C92.24 1.08 96.09 2.72 99.86 4.31 C143.35 22.68 179.57 37.98 179.57 80.62 L179.57 171.84 C166.03 177.28 151.94 182.35 137.31 186.97 C121.83 191.91 105.99 196.24 89.74 200.01 C74.04 196.33 58.54 192.08 43.26 187.23';

// Per-flag fits (flagcdn ISO codes): tricolours stretch (cropping eats
// outer stripes), circular emblems stay uniform (suns/discs must be
// round), everything else zooms into a squarer box for more detail.
const STRETCH_FLAGS = new Set(['ie', 'fr', 'it', 'ro']);
const EXACT_FLAGS = new Set(['jp', 'ar', 'uy']);

/**
 * Flag shield — the reference sticker: pale border band on the exact
 * outer silhouette, flag clipped to the exact inner boundary. `width`
 * scales the whole artwork (height follows the true 0.9045 aspect).
 */
export function TeamFlagShield({
  flagCode,
  width = 40,
}: {
  flagCode: string;
  width?: number;
}) {
  const height = (width / OUTER_W) * OUTER_H;
  const flagUrl = `https://flagcdn.com/w160/${flagCode}.png`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${OUTER_W} ${OUTER_H}`}>
      <Defs>
        <ClipPath id={`crest-${flagCode}`}>
          <Path d={INNER_PATH} />
        </ClipPath>
      </Defs>
      {/* Flip vertically so the peak sits at the top, point at the
          bottom. */}
      <G transform={`translate(0, ${OUTER_H}) scale(1, -1)`}>
        <Path d={OUTER_PATH} fill="#EFF3F5" stroke="#E2E8EA" strokeWidth={1.5} />
        <G transform={`translate(${INNER_X}, ${INNER_Y})`}>
          <G clipPath={`url(#crest-${flagCode})`}>
            {/* Un-flip inside the clip so the flag draws upright. */}
            <G transform={`translate(0, ${INNER_H}) scale(1, -1)`}>
              {STRETCH_FLAGS.has(flagCode) ? (
                <SvgImage
                  href={{ uri: flagUrl }}
                  x={0}
                  y={0}
                  width={INNER_W}
                  height={INNER_H}
                  preserveAspectRatio="none"
                />
              ) : EXACT_FLAGS.has(flagCode) ? (
                <SvgImage
                  href={{ uri: flagUrl }}
                  x={0}
                  y={0}
                  width={INNER_W}
                  height={INNER_H}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <SvgImage
                  href={{ uri: flagUrl }}
                  x={(INNER_W - INNER_H) / 2}
                  y={0}
                  width={INNER_H}
                  height={INNER_H}
                  preserveAspectRatio="none"
                />
              )}
            </G>
          </G>
        </G>
      </G>
    </Svg>
  );
}
