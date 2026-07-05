/**
 * Cubic-Bezier smoothed open path through an array of points, using a
 * Catmull-Rom → Bezier conversion at tension 1. Shared by the Form
 * sparkline and the Ranking Trajectory chart so both draw with the same
 * curve style. Returns both the SVG `d` string and an approximation of
 * the path length (sum of straight-line distances between points) —
 * accurate enough for stroke-dasharray animations without walking the
 * actual bezier arcs.
 */

/**
 * Chart line colour — dark grey (gray-700). Single-team data lines
 * (Form sparkline, Ranking Trajectory, player trends) draw in this
 * neutral grey with outcome-coloured dots (green/red/grey) carrying the
 * directional read; it doubles as the benchmark-tick colour (KPI
 * T1-average marker, scout median marker). The blue-accent-line scheme
 * was tried and reverted 2026-07-05 — Frank prefers grey lines with
 * red/green markers.
 */
export const CHART_LINE_COLOR = '#374151';

export function smoothLinePath(
  points: readonly { x: number; y: number }[],
): { path: string; length: number } {
  const n = points.length;
  if (n < 2) return { path: '', length: 0 };
  const start = points[0]!;
  let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
  let length = 0;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i + 2 < n ? points[i + 2]! : points[i + 1]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    length += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return { path: d, length };
}
