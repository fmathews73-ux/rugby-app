/**
 * Shared building blocks for the six-axis Team Radar visual. Extracted from
 * `team-radar.tsx` so the drill-in card and the landing "Top Ranked" hero
 * card can compose the same SVG chart + axis math without duplicating them.
 */

import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { TeamAggregate } from '@/hooks/use-team-aggregate';

// Team polygon rendered in a light blue for a distinct BI treatment on the
// Team Profile card — visually separates the "shape of the team" from the
// dark text-token used for numeric readouts elsewhere in the app.
//
// When the compare (away) team is active on the Profile card, callers
// pass the `RADAR_AWAY_*` tokens instead to keep the away-team colour
// convention consistent with the Momentum card (home = blue family,
// away = purple family across every match-scoped BI chart).
export const RADAR_COLOR = '#3B82F6';
export const RADAR_FILL = '#93C5FD';
export const RADAR_AWAY_COLOR = '#8B5CF6';
export const RADAR_AWAY_FILL = '#C4B5FD';
export const REFERENCE_COLOR = Colors.light.textSecondary;

export interface RadarAxis {
  key: string;
  label: string;
  /** Team's value normalised to 0–1 (0 = worst, 1 = ceiling). */
  value: number;
  /** Raw scalar shown in the info modal / legend. */
  raw: string;
}

/**
 * Fixed normalisation ceilings — realistic Tier-1 international ranges. A
 * team hitting the ceiling on any axis is at the very top of the
 * international scale for that dimension.
 */
export const AXIS_CEILINGS = {
  attack: 40,      // avg points scored per game
  defence: 40,     // avg points conceded per game (inverted)
  setPiece: 100,   // (scrum + lineout) success %
  discipline: 12,  // avg penalties conceded per game (inverted)
  kicking: 45,     // avg kick meters per kick in play
  territory: 60,   // avg territory %
  possession: 60,  // avg possession %
  turnovers: 15,   // avg turnovers WON per game (higher = better)
};

export function buildRadarAxes(data: TeamAggregate | undefined): RadarAxis[] {
  if (!data) {
    return [
      { key: 'attack', label: 'Attack', value: 0, raw: '—' },
      { key: 'defence', label: 'Defence', value: 0, raw: '—' },
      { key: 'setPiece', label: 'Set-piece', value: 0, raw: '—' },
      { key: 'discipline', label: 'Discipline', value: 0, raw: '—' },
      { key: 'kicking', label: 'Kicking', value: 0, raw: '—' },
      { key: 'territory', label: 'Territory', value: 0, raw: '—' },
      { key: 'possession', label: 'Possession', value: 0, raw: '—' },
      { key: 'turnovers', label: 'Turnovers', value: 0, raw: '—' },
    ];
  }
  const g = data.perGame;
  const setPiecePercent = (g.scrumSuccessPercent + g.lineoutSuccessPercent) / 2;
  const metersPerKick = g.kicksInPlay > 0 ? g.kickMeters / g.kicksInPlay : 0;

  return [
    {
      key: 'attack',
      label: 'Attack',
      value: clip01(g.pointsScored / AXIS_CEILINGS.attack),
      raw: `${g.pointsScored.toFixed(1)} pts/g`,
    },
    {
      key: 'defence',
      label: 'Defence',
      value: clip01(1 - g.pointsConceded / AXIS_CEILINGS.defence),
      raw: `${g.pointsConceded.toFixed(1)} pts conceded/g`,
    },
    {
      key: 'setPiece',
      label: 'Set-piece',
      value: clip01(setPiecePercent / AXIS_CEILINGS.setPiece),
      raw: `${setPiecePercent.toFixed(0)}% success`,
    },
    {
      key: 'discipline',
      label: 'Discipline',
      value: clip01(1 - g.penaltiesConceded / AXIS_CEILINGS.discipline),
      raw: `${g.penaltiesConceded.toFixed(1)} pens/g`,
    },
    {
      key: 'kicking',
      label: 'Kicking',
      value: clip01(metersPerKick / AXIS_CEILINGS.kicking),
      raw: `${metersPerKick.toFixed(0)} m/kick`,
    },
    {
      key: 'territory',
      label: 'Territory',
      value: clip01(g.territoryPercent / AXIS_CEILINGS.territory),
      raw: `${g.territoryPercent.toFixed(0)}% territory`,
    },
    {
      key: 'possession',
      label: 'Possession',
      value: clip01(g.possessionPercent / AXIS_CEILINGS.possession),
      raw: `${g.possessionPercent.toFixed(0)}% possession`,
    },
    {
      key: 'turnovers',
      label: 'Turnovers',
      value: clip01(g.turnoversWon / AXIS_CEILINGS.turnovers),
      raw: `${g.turnoversWon.toFixed(1)} won/g`,
    },
  ];
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Cubic-Bezier smoothed closed path through an array of points. Each
 * segment's control points are derived from the two neighbouring points
 * on either side (Catmull-Rom → Bezier conversion at tension 1), so the
 * curve passes exactly through each data point but has no sharp corners.
 */
function smoothClosedPath(points: readonly { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 2) return '';
  const at = (i: number) => points[((i % n) + n) % n]!;
  const start = at(0);
  let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

/**
 * SVG radar chart. Renders a primary team polygon over a 6-axis hexagon
 * with concentric rings + spokes. When `compareAxes` is supplied, overlays
 * a dashed grey polygon for the compare team and hides the 50%-radius
 * reference hexagon (two team polygons plus a reference is too busy).
 */
export function RadarChart({
  axes,
  compareAxes,
  strokeColor = RADAR_COLOR,
  fillColor = RADAR_FILL,
  compareStrokeColor = RADAR_AWAY_COLOR,
  compareFillColor = RADAR_AWAY_FILL,
}: {
  axes: readonly RadarAxis[];
  compareAxes?: readonly RadarAxis[] | null;
  /** Primary polygon stroke + dot colour. Defaults to home-blue. */
  strokeColor?: string;
  /** Primary polygon fill colour. Defaults to the home-blue fill token. */
  fillColor?: string;
  /** Compare-team polygon stroke + dot colour. Defaults to away-purple.
   *  Only used when `compareAxes` is supplied. */
  compareStrokeColor?: string;
  /** Compare-team polygon fill colour. Defaults to the away-purple
   *  fill token. Rendered with the same opacity as the primary fill so
   *  overlap regions naturally darken via blending. */
  compareFillColor?: string;
}) {
  // Radar geometry — grown 30% from the original 260×240 / r=82 layout so
  // the hexagon dominates the Team Profile card rather than sitting in the
  // middle with a lot of white space around it. Axis labels sit at r + 16
  // outside the polygon, so the viewBox y-center is nudged down to keep
  // the top "Attack" label inside the canvas.
  const size = 320;
  const height = 300;
  const cx = size / 2;
  const cy = 150;
  const r = 108;

  const angleFor = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
  const pointOn = (i: number, radius: number) => {
    const a = angleFor(i);
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  };

  // Team + compare data-line vertices → smoothed Bézier paths so the curves
  // pass through each axis without sharp corners. Reference hexagon +
  // gridlines stay sharp (they're benchmarks / grid, not data).
  const teamVerts = axes.map((ax, i) => pointOn(i, r * ax.value));
  const teamPath = smoothClosedPath(teamVerts);
  const compareVerts = compareAxes
    ? compareAxes.map((ax, i) => pointOn(i, r * ax.value))
    : null;
  const comparePath = compareVerts ? smoothClosedPath(compareVerts) : null;
  const referencePoints = axes
    .map((_, i) => pointOn(i, r * 0.5))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${size} ${height}`}>
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const pts = axes
          .map((_, i) => pointOn(i, r * frac))
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ');
        return (
          <Polygon
            key={frac}
            points={pts}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={1}
          />
        );
      })}
      {axes.map((_, i) => {
        const end = pointOn(i, r);
        return (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="#F3F4F6"
            strokeWidth={1}
          />
        );
      })}
      {/* 50%-reference hexagon only shows in single-team mode. In
          two-team overlay mode the second polygon IS the reference. */}
      {!comparePath ? (
        <Polygon
          points={referencePoints}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}
      {/* Compare-team polygon (away, purple). Drawn BEFORE the primary
          polygon so that where the two overlap, the primary sits on top
          and the fill blend darkens naturally rather than one team's
          fill masking the other. */}
      {comparePath ? (
        <Path
          d={comparePath}
          fill={compareFillColor}
          fillOpacity={0.35}
          stroke={compareStrokeColor}
          strokeWidth={1}
        />
      ) : null}
      <Path
        d={teamPath}
        fill={fillColor}
        fillOpacity={0.35}
        stroke={strokeColor}
        strokeWidth={1}
      />
      {compareAxes?.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={`c${i}`} cx={p.x} cy={p.y} r={2} fill={compareStrokeColor} />;
      })}
      {axes.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={i} cx={p.x} cy={p.y} r={2} fill={strokeColor} />;
      })}
      {axes.map((ax, i) => {
        const labelP = pointOn(i, r + 16);
        return (
          <SvgText
            key={i}
            x={labelP.x}
            y={labelP.y + 3}
            fill={Colors.light.textSecondary}
            fontSize={12}
            fontWeight="400"
            textAnchor="middle">
            {ax.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
