import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useFixture, useTeam } from '@/api/hooks';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import {
  fixtureHasMomentum,
  momentumTotalMinutes,
  momentumWindowMinutes,
  useMatchMomentumTimeline,
  type MomentumSample,
} from '@/hooks/use-match-momentum-timeline';
import { smoothLinePath } from '@/lib/smooth-path';

// Team colour tokens for the momentum mirror. Home = light blue family,
// Away = light purple family. The line uses the strong hue, the fill
// uses the light hue with a vertical fade toward the zero baseline.
const HOME_LINE = '#3B82F6';
const HOME_FILL = '#93C5FD';
const AWAY_LINE = '#8B5CF6';
const AWAY_FILL = '#C4B5FD';

/**
 * Momentum — mirrored area chart showing the rolling scoring density
 * for each side across the full 80-minute match. Home team's line lifts
 * above the zero baseline in light blue; away team's line drops below
 * in light purple. Vertical dashed lines mark KO / HT / FT.
 *
 * The metric per minute t is the sum of points scored in the trailing
 * `momentumWindowMinutes()` window — a stable "how much scoring is
 * happening now" read that responds to bursts without flapping on
 * single events. See `use-match-momentum-timeline.ts`.
 *
 * Match-scoped only. Scheduled fixtures render an empty state.
 */
export function CombinedPointsPattern({
  fixtureId,
  homeTeamId,
  awayTeamId,
  style,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const fixture = useFixture(fixtureId);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);
  const { samples, maxAbs, effectiveMinute, isLoading, hasData } =
    useMatchMomentumTimeline(fixtureId, homeTeamId, awayTeamId);

  const homeShort = homeTeam.data?.short_name ?? homeTeamId.toUpperCase();
  const awayShort = awayTeam.data?.short_name ?? awayTeamId.toUpperCase();
  const canRender = fixtureHasMomentum(fixture.data?.status);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Momentum</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Momentum">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {/* Colour-swatch legend takes the place of the old toggle pill.
            Swatches use the light FILL tokens so the chip colour reads
            as the polygon body — matches what the eye sees on the
            chart, not the darker stroke. */}
        <View style={styles.legend}>
          <LegendChip label={homeShort} color={HOME_FILL} />
          <LegendChip label={awayShort} color={AWAY_FILL} />
        </View>
      </View>

      {!canRender ? (
        <Text style={styles.empty}>Momentum populates once the match is under way.</Text>
      ) : isLoading && !hasData ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <MomentumMirror
          samples={samples}
          maxAbs={maxAbs}
          effectiveMinute={effectiveMinute}
        />
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── Chart ──────────────────────────────────────────────────────────────────

/**
 * Zero-sum momentum chart. A SINGLE signed curve — home minus away —
 * that swings above the baseline when home has the initiative and below
 * when away does. The curve never shows both teams simultaneously
 * dominant, which reflects how momentum actually works in a match.
 *
 * The curve is filled in two halves via SVG clip paths: the portion
 * above the baseline uses the home-blue gradient, the portion below
 * uses the away-purple gradient. Line strokes follow the same clip
 * treatment so colour cleanly hands off at every zero-crossing.
 *
 * Curve drawn only up to `effectiveMinute` — live matches leave the
 * post-live region of the canvas empty rather than stretching a stale
 * curve across it.
 */
function MomentumMirror({
  samples,
  maxAbs,
  effectiveMinute,
}: {
  samples: readonly MomentumSample[];
  maxAbs: number;
  effectiveMinute: number;
}) {
  // Measured canvas — geometry in real pixels (no viewBox stretching),
  // filling whatever height the carousel grants the card.
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const width = canvas.w;
  const height = canvas.h;
  // 8pt horizontal padding matches the other insights charts (Preview
  // sparklines, Scoring Progression) so all match-scoped charts share
  // one plot-area rhythm.
  const padX = 8;
  const padTop = 20;
  const padBottom = 24;
  const plotHeight = height - padTop - padBottom;
  const midY = padTop + plotHeight / 2;
  const halfChart = plotHeight / 2;

  const total = momentumTotalMinutes();

  const xForMinute = (m: number) =>
    padX + (m / total) * (width - 2 * padX);

  const drawable = samples.filter((p) => p.minute <= effectiveMinute);

  // Single signed curve: y is above midY when net > 0 (home ahead),
  // below when net < 0 (away ahead).
  const svgPoints = drawable.map((p) => ({
    x: xForMinute(p.minute),
    y: midY - (p.net / maxAbs) * halfChart,
  }));

  const smoothPath = svgPoints.length >= 2 ? smoothLinePath(svgPoints).path : '';

  // Closed area path: trace the curve, drop back to the baseline at the
  // end, run along the baseline to the start, close. The resulting
  // shape covers the region between the curve and the baseline —
  // clip paths then split it into the "home" (above) and "away" (below)
  // halves at render time.
  const areaPath =
    svgPoints.length >= 2
      ? `${smoothPath} L ${svgPoints[svgPoints.length - 1]!.x.toFixed(1)} ${midY.toFixed(1)} L ${svgPoints[0]!.x.toFixed(1)} ${midY.toFixed(1)} Z`
      : '';

  // Primary milestones (KO, HT, FT) get a label along the top; the two
  // intermediate quarter markers (20', 60') are lighter dashed guides
  // without labels so the eye can pace the timeline without clutter.
  const primaryMilestones: readonly { minute: number; label: string }[] = [
    { minute: 0, label: 'KO' },
    { minute: 40, label: 'HT' },
    { minute: 80, label: 'FT' },
  ];
  const intermediateMilestones: readonly number[] = [20, 60];

  return (
    <View
      style={styles.chartFill}
      onLayout={(e) =>
        setCanvas({
          w: Math.round(e.nativeEvent.layout.width),
          h: Math.round(e.nativeEvent.layout.height),
        })
      }>
      {width > 0 && height > 0 ? (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        {/* Home fill (upper half) — strong colour at the peak, fading
            to near-transparent at the zero baseline so the two halves
            don't collide at the axis. */}
        <LinearGradient id="momentum-home-fill" x1="0" y1={padTop} x2="0" y2={midY} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={HOME_FILL} stopOpacity="0.7" />
          <Stop offset="1" stopColor={HOME_FILL} stopOpacity="0.1" />
        </LinearGradient>
        {/* Away fill (lower half) — mirror gradient. Transparent at the
            baseline, strong colour at the trough. */}
        <LinearGradient id="momentum-away-fill" x1="0" y1={midY} x2="0" y2={height - padBottom} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={AWAY_FILL} stopOpacity="0.1" />
          <Stop offset="1" stopColor={AWAY_FILL} stopOpacity="0.7" />
        </LinearGradient>
        {/* Clip rectangles that split the plot area at the baseline.
            The same signed-curve path is drawn twice — once clipped
            above the baseline (home colours) and once clipped below
            (away colours). Every zero-crossing of the curve resolves
            automatically as a colour hand-off. */}
        <ClipPath id="momentum-clip-above">
          <Rect x={0} y={padTop} width={width} height={midY - padTop} />
        </ClipPath>
        <ClipPath id="momentum-clip-below">
          <Rect x={0} y={midY} width={width} height={height - padBottom - midY} />
        </ClipPath>
      </Defs>

      {/* Intermediate quarter guides (20', 60') — lightest dash so they
          pace the timeline without competing with the primary
          KO / HT / FT verticals. */}
      {intermediateMilestones.map((m) => (
        <Line
          key={`imi-${m}`}
          x1={xForMinute(m)}
          y1={padTop}
          x2={xForMinute(m)}
          y2={height - padBottom}
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      ))}

      {/* Primary milestone verticals — KO, HT, FT. Slightly stronger
          than the intermediates and dashed so they read as structural
          anchors of the 80' timeline. */}
      {primaryMilestones.map((m) => (
        <Line
          key={`ms-${m.minute}`}
          x1={xForMinute(m.minute)}
          y1={padTop}
          x2={xForMinute(m.minute)}
          y2={height - padBottom}
          stroke="#E5E7EB"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}

      {/* Zero baseline — the mirror axis. Medium grey at 1px so it
          reads as a quiet structural reference the two coloured halves
          swing around, without competing for attention with the fills. */}
      <Line
        x1={padX}
        y1={midY}
        x2={width - padX}
        y2={midY}
        stroke="#9CA3AF"
        strokeWidth={1}
      />

      {/* Fill — home half (above the baseline). Same closed area path
          as the away fill; the clip rectangle keeps only the portion
          above midY visible, so when the signed curve dips below the
          baseline nothing renders here (no home momentum in that
          window). */}
      {areaPath ? (
        <Path
          d={areaPath}
          fill="url(#momentum-home-fill)"
          stroke="none"
          clipPath="url(#momentum-clip-above)"
        />
      ) : null}
      {/* Fill — away half (below the baseline). Mirror of the above. */}
      {areaPath ? (
        <Path
          d={areaPath}
          fill="url(#momentum-away-fill)"
          stroke="none"
          clipPath="url(#momentum-clip-below)"
        />
      ) : null}

      {/* Line stroke — same signed curve, split into home / away
          colours by the same clip pair. Colour hands off exactly at
          the zero baseline at every crossing. */}
      {smoothPath ? (
        <>
          <Path
            d={smoothPath}
            stroke={HOME_LINE}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
            clipPath="url(#momentum-clip-above)"
          />
          <Path
            d={smoothPath}
            stroke={AWAY_LINE}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
            clipPath="url(#momentum-clip-below)"
          />
        </>
      ) : null}

      {/* Primary milestone labels along the top. */}
      {primaryMilestones.map((m) => (
        <SvgText
          key={`msl-${m.minute}`}
          x={xForMinute(m.minute)}
          y={padTop - 6}
          fill={Colors.light.textSecondary}
          fontSize={10}
          fontWeight="700"
          textAnchor={
            m.minute === 0 ? 'start' : m.minute === total ? 'end' : 'middle'
          }>
          {m.label}
        </SvgText>
      ))}

      {/* Minute ticks along the bottom — 20-minute intervals to anchor
          the game flow without cluttering the axis. */}
      {[0, 20, 40, 60, 80].map((m) => (
        <SvgText
          key={`x-${m}`}
          x={xForMinute(m)}
          y={height - 6}
          fill={Colors.light.textSecondary}
          fontSize={10}
          fontWeight="600"
          textAnchor={m === 0 ? 'start' : m === total ? 'end' : 'middle'}>
          {`${m}'`}
        </SvgText>
      ))}
    </Svg>
      ) : null}
    </View>
  );
}

// ─── Info modal ─────────────────────────────────────────────────────────────

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const window = momentumWindowMinutes();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Momentum</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Momentum is a zero-sum read: at any moment one side has the
            initiative and the other doesn't. For each match minute we
            weight each team's attacking events in the trailing {window}
            -minute window (carries, line breaks, turnovers won, try
            assists, tries, conversions, penalty and drop goals) and
            plot the signed difference (home minus away).
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            When the curve lifts above the baseline in light blue, the{' '}
            <Text style={styles.modalStrong}>home side</Text> is on top
            in that window. When it dips below in light purple, the{' '}
            <Text style={styles.modalStrong}>away side</Text> owns the
            phase. Bigger swings mean bigger momentum shifts. Vertical
            guides mark KO, HT and FT with quarter markers at 20' and
            60'.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.bold,
    letterSpacing: TextTracking.wide,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  // Legend styling matches the Scoring Progression card so the two
  // temporal cards on the Insights pane share one grammar.
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 3,
    borderRadius: 1,
  },
  legendText: {
    fontSize: TextSize.xs,
    fontWeight: TextWeight.semibold,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  // Fills the card height the carousel grants (tallest-sibling
  // normalisation); minHeight preserves the original canvas in
  // intrinsic-height contexts.
  chartFill: {
    flex: 1,
    minHeight: 200,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: TextSize.lg,
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalBody: {
    fontSize: TextSize.sm,
    color: Colors.light.text,
    lineHeight: 20,
  },
  modalStrong: {
    fontWeight: TextWeight.bold,
    color: Colors.light.text,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.one,
  },
});
