import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';


import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors } from '@/constants/theme';

const SUBJECT_COLOR = '#059669';
const POOL_COLOR = '#9CA3AF';

export interface MatrixPoint {
  id: string;
  code: string;
  /** Raw x value — larger plots further right. */
  x: number;
  /** Raw y value — SMALLER plots higher (both current matrices use
   *  lower-is-better y metrics: points conceded, penalties). */
  y: number;
}

/**
 * Generic strategy-matrix scatter: the whole pool as muted dots, the
 * subject highlighted with its code, median crosshairs, quadrant
 * labels tucked into the corners. Measured-canvas pixel geometry,
 * static, shared by every 2x2 insights card.
 */
export function MatrixChart({
  points,
  subjectId,
  quadrants,
  xCaption,
  yCaption,
  minHeight = 200,
}: {
  points: readonly MatrixPoint[];
  subjectId: string;
  /** Quadrant labels, centred in each quadrant: top-right, top-left,
   *  bottom-right, bottom-left. */
  quadrants: { tr: string; tl: string; br: string; bl: string };
  xCaption: string;
  /** Rotated left-edge caption, reading upward — the arrow should
   *  describe what increases towards the TOP of the chart. */
  yCaption: string;
  minHeight?: number;
}) {
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });

  // Fade-in driver (shared arrival grammar).
  const ink = useChartInk();
  const width = canvas.w;
  const height = canvas.h;
  const padLeft = 18;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 18;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const midXVal = median(xs);
  const midYVal = median(ys);
  // Symmetric range around the median so the crosshair intersects at
  // the exact CENTRE of the plot — a skewed pool otherwise drags the
  // dashed cross off-centre. Dots keep their true quadrants; only the
  // scale is centred.
  const xHalf = Math.max(...xs.map((v) => Math.abs(v - midXVal)), 0) + 2;
  const yHalf = Math.max(...ys.map((v) => Math.abs(v - midYVal)), 0) + 2;
  const xMin = midXVal - xHalf;
  const xMax = midXVal + xHalf;
  const yMin = midYVal - yHalf;
  const yMax = midYVal + yHalf;

  const plotBottom = height - padBottom;
  const xOf = (v: number) =>
    padLeft + ((v - xMin) / (xMax - xMin)) * (width - padLeft - padRight);
  // Smaller raw y plots HIGHER (lower-is-better metrics).
  const yOf = (v: number) => padTop + ((v - yMin) / (yMax - yMin)) * (plotBottom - padTop);

  const midX = xOf(midXVal);
  const midY = yOf(midYVal);
  const subject = points.find((p) => p.id === subjectId);

  return (
    <View
      style={[styles.chartFill, { minHeight }]}
      onLayout={(e) =>
        setCanvas({
          w: Math.round(e.nativeEvent.layout.width),
          h: Math.round(e.nativeEvent.layout.height),
        })
      }>
      {width > 0 && height > 0 ? (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Median crosshairs. */}
          <Line x1={padLeft} y1={midY} x2={width - padRight} y2={midY} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
          <Line x1={midX} y1={padTop} x2={midX} y2={plotBottom} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />

          {/* Quadrant labels — whisper-grey, CENTRED in each quadrant
              (rendered beneath the dots). */}
          <SvgText x={(midX + width - padRight) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontFamily="Barlow_500Medium" fontSize={9} textAnchor="middle">
            {quadrants.tr}
          </SvgText>
          <SvgText x={(padLeft + midX) / 2} y={(padTop + midY) / 2 + 3} fill="#D1D5DB" fontFamily="Barlow_500Medium" fontSize={9} textAnchor="middle">
            {quadrants.tl}
          </SvgText>
          <SvgText x={(midX + width - padRight) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontFamily="Barlow_500Medium" fontSize={9} textAnchor="middle">
            {quadrants.br}
          </SvgText>
          <SvgText x={(padLeft + midX) / 2} y={(midY + plotBottom) / 2 + 3} fill="#D1D5DB" fontFamily="Barlow_500Medium" fontSize={9} textAnchor="middle">
            {quadrants.bl}
          </SvgText>

          {/* X-axis caption. */}
          <SvgText x={(padLeft + width - padRight) / 2} y={height - 4} fill={Colors.light.textSecondary} fontFamily="Barlow_500Medium" fontSize={9} letterSpacing={0.4} textAnchor="middle">
            {xCaption}
          </SvgText>
          {/* Y-axis caption — rotated, reading upward along the left
              edge. */}
          <SvgText
            x={8}
            y={(padTop + plotBottom) / 2}
            fill={Colors.light.textSecondary}
            fontFamily="Barlow_500Medium"
            fontSize={9}
            letterSpacing={0.4}
            textAnchor="middle"
            transform={`rotate(-90, 8, ${(padTop + plotBottom) / 2})`}>
            {yCaption}
          </SvgText>
        </Svg>
      ) : null}
      {width > 0 && height > 0 ? (
        /* Dot layer — the whole pool plus the subject's dot and code
           fade in over the static frame. */
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, opacity: ink }}>
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Pool dots first, subject on top. */}
            {points.map((p) =>
              p.id === subjectId ? null : (
                <Circle key={p.id} cx={xOf(p.x)} cy={yOf(p.y)} r={2.5} fill={POOL_COLOR} opacity={0.55} />
              ),
            )}
            {subject ? (
              <>
                <Circle cx={xOf(subject.x)} cy={yOf(subject.y)} r={4.5} fill={SUBJECT_COLOR} />
                <SvgText
                  x={xOf(subject.x)}
                  y={yOf(subject.y) >= padTop + 18 ? yOf(subject.y) - 8 : yOf(subject.y) + 14}
                  fill={Colors.light.text}
                  fontFamily="BarlowCondensed_700Bold_Italic"
                  fontSize={11}
                  textAnchor="middle">
                  {subject.code}
                </SvgText>
              </>
            ) : null}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

const styles = StyleSheet.create({
  chartFill: {
    flex: 1,
  },
});
