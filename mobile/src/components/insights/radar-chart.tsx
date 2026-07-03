/**
 * Shared building blocks for the six-axis Team Radar visual. Extracted from
 * `team-radar.tsx` so the drill-in card and the landing "Top Ranked" hero
 * card can compose the same SVG chart + axis math without duplicating them.
 */

import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { TeamAggregate } from '@/hooks/use-team-aggregate';

export const RADAR_COLOR = Colors.light.text;
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
  ];
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
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
}: {
  axes: readonly RadarAxis[];
  compareAxes?: readonly RadarAxis[] | null;
}) {
  const size = 260;
  const cx = size / 2;
  const cy = 120;
  const r = 82;

  const angleFor = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
  const pointOn = (i: number, radius: number) => {
    const a = angleFor(i);
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  };

  const teamPoints = axes
    .map((ax, i) => pointOn(i, r * ax.value))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const referencePoints = axes
    .map((_, i) => pointOn(i, r * 0.5))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const comparePoints = compareAxes
    ? compareAxes
        .map((ax, i) => pointOn(i, r * ax.value))
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ')
    : null;

  return (
    <Svg width="100%" height={240} viewBox={`0 0 ${size} 240`}>
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
            strokeWidth={0.8}
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
            strokeWidth={0.8}
          />
        );
      })}
      {!comparePoints ? (
        <Polygon
          points={referencePoints}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}
      {comparePoints ? (
        <Polygon
          points={comparePoints}
          fill="none"
          stroke={REFERENCE_COLOR}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      ) : null}
      <Polygon
        points={teamPoints}
        fill={RADAR_COLOR}
        fillOpacity={0.12}
        stroke={RADAR_COLOR}
        strokeWidth={1.5}
      />
      {compareAxes?.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={`c${i}`} cx={p.x} cy={p.y} r={1.8} fill={REFERENCE_COLOR} />;
      })}
      {axes.map((ax, i) => {
        const p = pointOn(i, r * ax.value);
        return <Circle key={i} cx={p.x} cy={p.y} r={2.2} fill={RADAR_COLOR} />;
      })}
      {axes.map((ax, i) => {
        const labelP = pointOn(i, r + 16);
        return (
          <SvgText
            key={i}
            x={labelP.x}
            y={labelP.y + 3}
            fill={Colors.light.text}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle">
            {ax.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
