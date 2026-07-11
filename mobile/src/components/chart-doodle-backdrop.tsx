import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';

/**
 * The chart-doodle backdrop — a WhatsApp-style wallpaper whose glyphs
 * are OUR chart anatomy (owner call 2026-07-11): radar web, 2×2
 * scatter, momentum wave, diverging bars, form dots, gap ladder,
 * progression staircase, score boxes, W/D/L trio, jersey, shield,
 * posts, ball, the brand fingerprint and the four tab icons.
 *
 * MAXIMUM density with ZERO overlap (owner call): glyphs are laid out
 * on a strict grid — one glyph per 40pt cell, each declaring its own
 * bounding radius, scaled to a per-cell target radius and jittered
 * only within the margin its radius leaves. Collision-free by
 * construction, WhatsApp-dense by cell count (7×9 majors + corner
 * fillers per tile). Placement is deterministic (hash of the cell
 * index) so the wallpaper is identical on every render.
 *
 * One 280×360 tile repeated via SVG <Pattern> at userSpaceOnUse (real
 * pixels — no viewBox stretching, per the chart-rendering rules).
 */

const INK = '#C7CBD1';
const W = 1.3;

// The EXACT Ionicons finger-print-outline geometry (512 viewBox,
// MIT), embedded verbatim so the wallpaper print matches the brand
// mark stroke-for-stroke (owner call 2026-07-11). The outline variant
// is authored as fills, so it renders with fill, not stroke.
const FINGERPRINT_PATH =
  'M390.42 75.28a10.45 10.45 0 01-5.32-1.44C340.72 50.08 302.35 40 256.35 40c-45.77 0-89.23 11.28-128.76 33.84C122 77 115.11 74.8 111.87 69a12.4 12.4 0 014.63-16.32A281.81 281.81 0 01256.35 16c49.23 0 92.23 11.28 139.39 36.48a12 12 0 014.85 16.08 11.3 11.3 0 01-10.17 6.72zm-330.79 126a11.73 11.73 0 01-6.7-2.16 12.26 12.26 0 01-2.78-16.8c22.89-33.6 52-60 86.69-78.48 72.58-38.84 165.51-39.12 238.32-.24 34.68 18.48 63.8 44.64 86.69 78a12.29 12.29 0 01-2.78 16.8 11.26 11.26 0 01-16.18-2.88c-20.8-30.24-47.15-54-78.36-70.56-66.34-35.28-151.18-35.28-217.29.24-31.44 16.8-57.79 40.8-78.59 71a10 10 0 01-9.02 5.08zM204.1 491a10.66 10.66 0 01-8.09-3.6C175.9 466.48 165 453 149.55 424c-16-29.52-24.27-65.52-24.27-104.16 0-71.28 58.71-129.36 130.84-129.36S387 248.56 387 319.84a11.56 11.56 0 11-23.11 0c0-58.08-48.32-105.36-107.72-105.36S148.4 261.76 148.4 319.84c0 34.56 7.39 66.48 21.49 92.4 14.8 27.6 25 39.36 42.77 58.08a12.67 12.67 0 010 17 12.44 12.44 0 01-8.56 3.68zm165.75-44.4c-27.51 0-51.78-7.2-71.66-21.36a129.1 129.1 0 01-55-105.36 11.57 11.57 0 1123.12 0 104.28 104.28 0 0044.84 85.44c16.41 11.52 35.6 17 58.72 17a147.41 147.41 0 0024-2.4c6.24-1.2 12.25 3.12 13.4 9.84a11.92 11.92 0 01-9.47 13.92 152.28 152.28 0 01-27.95 2.88zM323.38 496a13 13 0 01-3-.48c-36.76-10.56-60.8-24.72-86-50.4-32.37-33.36-50.16-77.76-50.16-125.28 0-38.88 31.9-70.56 71.19-70.56s71.2 31.68 71.2 70.56c0 25.68 21.5 46.56 48.08 46.56s48.08-20.88 48.08-46.56c0-90.48-75.13-163.92-167.59-163.92-65.65 0-125.75 37.92-152.79 96.72-9 19.44-13.64 42.24-13.64 67.2 0 18.72 1.61 48.24 15.48 86.64 2.32 6.24-.69 13.2-6.7 15.36a11.34 11.34 0 01-14.79-7 276.39 276.39 0 01-16.88-95c0-28.8 5.32-55 15.72-77.76 30.75-67 98.94-110.4 173.6-110.4 105.18 0 190.71 84.24 190.71 187.92 0 38.88-31.9 70.56-71.2 70.56s-71.2-31.68-71.2-70.56c.01-25.68-21.49-46.6-48.07-46.6s-48.08 20.88-48.08 46.56c0 41 15.26 79.44 43.23 108.24 22 22.56 43 35 75.59 44.4 6.24 1.68 9.71 8.4 8.09 14.64a11.39 11.39 0 01-10.87 9.16z';

const FINGERPRINT_GLYPH: Glyph = {
  r: 12,
  el: (
    <G transform="scale(0.0469) translate(-256,-256)">
      <Path d={FINGERPRINT_PATH} fill="currentColor" stroke="none" />
    </G>
  ),
};

// 8×10 cells of 35pt (owner call 2026-07-11: more concentration —
// tightened from 7×9 of 40pt).
const COLS = 8;
const ROWS = 10;
const CELL = 35;
const TILE_W = COLS * CELL; // 280
const TILE_H = ROWS * CELL; // 350

/** Deterministic 0..1 hash — same wallpaper every render. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Glyph {
  /** Max distance of any point from the glyph's own origin. */
  r: number;
  el: ReactNode;
}

const GLYPHS: Glyph[] = [
  // Radar web + shape
  {
    r: 20,
    el: (
      <>
        <Polygon points="20,0 10,17.3 -10,17.3 -20,0 -10,-17.3 10,-17.3" />
        <Polygon points="10,0 5,8.7 -5,8.7 -10,0 -5,-8.7 5,-8.7" />
        <Line x1={-20} y1={0} x2={20} y2={0} />
        <Line x1={-10} y1={-17.3} x2={10} y2={17.3} />
        <Line x1={10} y1={-17.3} x2={-10} y2={17.3} />
        <Polygon points="14,2 4,10 -8,6 -12,-2 -2,-12 9,-8" />
      </>
    ),
  },
  // Jersey
  {
    r: 15,
    el: (
      <Path d="M -8 -10 L -3 -13 C -1 -11, 1 -11, 3 -13 L 8 -10 L 11 -5 L 6 -3 L 6 10 L -6 10 L -6 -3 L -11 -5 Z" />
    ),
  },
  // 2×2 matrix with scatter
  {
    r: 26,
    el: (
      <>
        <Rect x={-18} y={-18} width={36} height={36} rx={4} />
        <Line x1={0} y1={-18} x2={0} y2={18} />
        <Line x1={-18} y1={0} x2={18} y2={0} />
        <Circle cx={-10} cy={-10} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={8} cy={-6} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={-3} cy={6} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={10} cy={10} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={-12} cy={12} r={1.7} fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Ball with seam
  {
    r: 11,
    el: (
      <>
        <Ellipse cx={0} cy={0} rx={11} ry={6.5} />
        <Path d="M -6 0 H 6 M -3 -2 V 2 M 0 -2 V 2 M 3 -2 V 2" strokeWidth={0.9} />
      </>
    ),
  },
  // Momentum wave on a baseline
  {
    r: 26,
    el: (
      <>
        <Line x1={-26} y1={0} x2={26} y2={0} />
        <Path d="M -26 0 C -18 -12, -8 -12, 0 0 C 8 12, 18 12, 26 0" />
      </>
    ),
  },
  // Flag shield
  {
    r: 14,
    el: (
      <Path d="M 0 -11 C 5 -9, 9 -9, 11 -10 L 11 2 C 11 8, 6 12, 0 14 C -6 12, -11 8, -11 2 L -11 -10 C -9 -9, -5 -9, 0 -11 Z" />
    ),
  },
  // Form-dot sequence
  {
    r: 23,
    el: (
      <>
        {[-22.5, -13.5, -4.5, 4.5, 13.5, 22.5].map((x) => (
          <Circle key={x} cx={x} cy={0} r={2.2} />
        ))}
      </>
    ),
  },
  // Goal posts
  {
    r: 17,
    el: (
      <>
        <Line x1={-10} y1={14} x2={-10} y2={-13} />
        <Line x1={10} y1={14} x2={10} y2={-13} />
        <Line x1={-10} y1={-3} x2={10} y2={-3} />
      </>
    ),
  },
  // Diverging bars on a spine
  {
    r: 20,
    el: (
      <>
        <Line x1={0} y1={-18} x2={0} y2={18} />
        <Line x1={0} y1={-11} x2={-16} y2={-11} strokeWidth={3.4} />
        <Line x1={0} y1={-11} x2={8} y2={-11} strokeWidth={3.4} />
        <Line x1={0} y1={0} x2={-6} y2={0} strokeWidth={3.4} />
        <Line x1={0} y1={0} x2={17} y2={0} strokeWidth={3.4} />
        <Line x1={0} y1={11} x2={-12} y2={11} strokeWidth={3.4} />
        <Line x1={0} y1={11} x2={10} y2={11} strokeWidth={3.4} />
      </>
    ),
  },
  // Brand fingerprint — the exact Ionicons geometry
  FINGERPRINT_GLYPH,
  // Gap ladder — rungs with end dots
  {
    r: 21,
    el: (
      <>
        <Line x1={-14} y1={-13} x2={10} y2={-13} />
        <Circle cx={-14} cy={-13} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={10} cy={-13} r={1.7} fill="currentColor" stroke="none" />
        <Line x1={-8} y1={-4} x2={15} y2={-4} />
        <Circle cx={-8} cy={-4} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={15} cy={-4} r={1.7} fill="currentColor" stroke="none" />
        <Line x1={-16} y1={5} x2={2} y2={5} />
        <Circle cx={-16} cy={5} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={2} cy={5} r={1.7} fill="currentColor" stroke="none" />
        <Line x1={-4} y1={14} x2={13} y2={14} />
        <Circle cx={-4} cy={14} r={1.7} fill="currentColor" stroke="none" />
        <Circle cx={13} cy={14} r={1.7} fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Score-box pair — one dark, one quiet
  {
    r: 17,
    el: (
      <>
        <Rect x={-17} y={-8} width={14} height={16} rx={3} fill="currentColor" stroke="none" />
        <Rect x={3} y={-8} width={14} height={16} rx={3} />
      </>
    ),
  },
  // Progression staircase with checkpoints
  {
    r: 24,
    el: (
      <>
        <Path d="M -20 14 L -8 14 L -8 4 L 4 4 L 4 -6 L 16 -6 L 16 -16" />
        <Circle cx={-8} cy={14} r={1.8} fill="currentColor" stroke="none" />
        <Circle cx={4} cy={4} r={1.8} fill="currentColor" stroke="none" />
        <Circle cx={16} cy={-6} r={1.8} fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Teams — people pair
  {
    r: 13,
    el: (
      <>
        <Circle cx={-4} cy={-5} r={3.5} />
        <Circle cx={5.5} cy={-3} r={2.8} />
        <Path d="M -10 8 C -10 2, -7 0, -4 0 C -1 0, 2 2, 2 8" />
        <Path d="M 3 7 C 3 3, 4.5 1.5, 5.5 1.5 C 8 1.5, 10 3.5, 10 7" />
      </>
    ),
  },
  // W/D/L tile trio
  {
    r: 21,
    el: (
      <>
        <Rect x={-20.5} y={-5} width={11} height={10} rx={2} fill="currentColor" stroke="none" />
        <Rect x={-5.5} y={-5} width={11} height={10} rx={2} />
        <Rect x={9.5} y={-5} width={11} height={10} rx={2} />
      </>
    ),
  },
  // Fixtures — calendar
  {
    r: 17,
    el: (
      <>
        <Rect x={-11} y={-9} width={22} height={20} rx={3} />
        <Line x1={-5} y1={-13} x2={-5} y2={-9} />
        <Line x1={5} y1={-13} x2={5} y2={-9} />
        <Circle cx={-5} cy={0} r={1.2} fill="currentColor" stroke="none" />
        <Circle cx={1} cy={0} r={1.2} fill="currentColor" stroke="none" />
        <Circle cx={-5} cy={6} r={1.2} fill="currentColor" stroke="none" />
        <Circle cx={1} cy={6} r={1.2} fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Tables — podium
  {
    r: 19,
    el: (
      <>
        <Rect x={-5} y={-10} width={10} height={18} />
        <Rect x={-16} y={-3} width={11} height={11} />
        <Rect x={5} y={-6} width={11} height={14} />
      </>
    ),
  },
  // Predictor — sparkles
  {
    r: 13,
    el: (
      <>
        <Path d="M 0 -9 L 2.2 -2.2 L 9 0 L 2.2 2.2 L 0 9 L -2.2 2.2 L -9 0 L -2.2 -2.2 Z" />
        <Path d="M 8 -9 L 9 -6 L 12 -5 L 9 -4 L 8 -1 L 7 -4 L 4 -5 L 7 -6 Z" />
      </>
    ),
  },
  // Fingerprint again — the brand mark earns double frequency in the
  // deck (owner call 2026-07-11: "I'm not seeing the fingerprint").
  FINGERPRINT_GLYPH,
];

/** One glyph per cell — scaled to its target radius, jittered inside
 *  the margin that radius leaves, deterministically. */
function cellPlacements(): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    // Stride 7 is coprime with the 18-glyph library, so horizontal
    // and vertical neighbours always draw different glyphs.
    const glyph = GLYPHS[(i * 7 + row * 3) % GLYPHS.length];
    const targetR = 10 + rnd(i) * 3.5; // 10..13.5
    const scale = targetR / glyph.r;
    const margin = CELL / 2 - targetR - 1;
    const dx = (rnd(i + 61) * 2 - 1) * margin;
    const dy = (rnd(i + 97) * 2 - 1) * margin;
    const rot = (rnd(i + 151) * 2 - 1) * 22;
    const cx = col * CELL + CELL / 2 + dx;
    const cy = row * CELL + CELL / 2 + dy;
    out.push(
      <G key={i} transform={`translate(${cx},${cy}) rotate(${rot}) scale(${scale})`}>
        {glyph.el}
      </G>,
    );
  }
  return out;
}

/** Tiny dots/plusses at interior grid intersections, plus micro-dots
 *  at every cell-edge midpoint — the corners and edges are guaranteed
 *  clear because cell glyphs never exceed targetR + margin inside
 *  their own cell (nearest edge-midpoint distance is CELL/2). */
function cornerFillers(): ReactNode[] {
  const out: ReactNode[] = [];
  for (let row = 1; row < ROWS; row++) {
    for (let col = 1; col < COLS; col++) {
      const x = col * CELL;
      const y = row * CELL;
      const kind = (row + col) % 3;
      if (kind === 0) {
        out.push(<Circle key={`f${row}-${col}`} cx={x} cy={y} r={1.8} />);
      } else if (kind === 1) {
        out.push(<Path key={`f${row}-${col}`} d={`M ${x - 3.5} ${y} h 7 m -3.5 -3.5 v 7`} />);
      } else {
        out.push(
          <Path
            key={`f${row}-${col}`}
            d={`M ${x} ${y - 4} l 1.5 2.5 2.5 1.5 -2.5 1.5 -1.5 2.5 -1.5 -2.5 -2.5 -1.5 2.5 -1.5 Z`}
          />,
        );
      }
    }
  }
  // Edge-midpoint micro-dots fill the seams between glyph cells.
  for (let row = 1; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if ((row + col) % 2 === 0) {
        out.push(
          <Circle key={`h${row}-${col}`} cx={col * CELL + CELL / 2} cy={row * CELL} r={1.2} />,
        );
      }
    }
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 1; col < COLS; col++) {
      if ((row + col) % 2 === 1) {
        out.push(
          <Circle key={`v${row}-${col}`} cx={col * CELL} cy={row * CELL + CELL / 2} r={1.2} />,
        );
      }
    }
  }
  return out;
}

export function ChartDoodleBackdrop({
  opacity = 0.5,
  ink = INK,
}: {
  opacity?: number;
  /** Doodle stroke/fill colour. Default chrome grey; pass a light
   *  colour for tone-on-tone use over dark/coloured grounds. */
  ink?: string;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="chart-doodles" patternUnits="userSpaceOnUse" width={TILE_W} height={TILE_H}>
            <G opacity={opacity} stroke={ink} color={ink} strokeWidth={W} fill="none">
              {cellPlacements()}
              {cornerFillers()}
            </G>
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#chart-doodles)" />
      </Svg>
    </View>
  );
}
