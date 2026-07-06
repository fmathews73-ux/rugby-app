import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import type { Fixture, MatchEvent } from '@rugby-app/shared';

import { useFixtureEvents, useTeam } from '@/api/hooks';
import { LineFadeRibbon } from '@/components/insights/line-fade-ribbon';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';

// Match-scoped team-colour convention shared with the Momentum card and
// the Profile radar: home = blue family, away = purple family. Strokes
// use the strong LINE tokens; the header legend swatches and the area
// fill gradients use the softer FILL tokens so the chip and halo
// colours read as the polygon body rather than the darker outline.
const HOME_LINE = '#3B82F6';
const HOME_FILL = '#93C5FD';
const AWAY_LINE = '#8B5CF6';
const AWAY_FILL = '#C4B5FD';

const FULL_TIME_MIN = 80;
const HALF_TIME_MIN = 40;

// SVG viewBox — matches Form / Trajectory / Momentum chart dims so the
// three cards stack visually consistently.
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
// Symmetric 8pt horizontal padding — matches Preview's Form / Ranking
// Trajectory `padX` so all four line charts on the fixture drill share
// one plot-area rhythm. Y-axis point labels have been dropped to fit;
// the header legend (`ENG 36 · FRA 28`) carries the scale context.
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

/**
 * Scoring Progression — cumulative-points "worm" for the match.
 *
 * Two step-lines rise from 0 at kick-off to each team's full-time total;
 * every scoring event drives a vertical jump at that minute. Broadcast
 * staple: instantly tells you who was ahead when, the biggest lead, and
 * the size of any comebacks. Both teams overlaid on the same axes so the
 * comparison is the point of the card — no toggle pill.
 *
 * Uses step lines (not smooth Bezier) because rugby scoring is discrete
 * — you can't have half a point mid-way between two events. Stroke
 * weights match the app's other line charts so the visual language stays
 * consistent (see [[project-rugby-app]] chart-line conventions).
 */
export function ScoringProgression({
  fixtureId,
  homeTeamId,
  awayTeamId,
  fixtureStatus,
  style,
}: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  fixtureStatus?: Fixture['status'];
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const events = useFixtureEvents(fixtureId, fixtureStatus);
  const homeTeam = useTeam(homeTeamId);
  const awayTeam = useTeam(awayTeamId);

  const series = useMemo(
    () => buildSeries(events.data ?? [], homeTeamId, awayTeamId),
    [events.data, homeTeamId, awayTeamId],
  );

  // Measured canvas — geometry in real pixels (no viewBox stretching),
  // filling whatever height the carousel grants the card.
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const CHART_W = canvas.w;
  const CHART_H = canvas.h;
  const PLOT_W = Math.max(1, CHART_W - PAD_LEFT - PAD_RIGHT);
  const PLOT_H = Math.max(1, CHART_H - PAD_TOP - PAD_BOTTOM);

  const homeFinal = series.home[series.home.length - 1]?.pts ?? 0;
  const awayFinal = series.away[series.away.length - 1]?.pts ?? 0;
  const yMax = niceYMax(Math.max(homeFinal, awayFinal, 10));

  const yTicks = buildYTicks(yMax);
  const xTicks = [0, 20, 40, 60, 80];

  const scaleX = (min: number) => PAD_LEFT + (min / FULL_TIME_MIN) * PLOT_W;
  const scaleY = (pts: number) => PAD_TOP + PLOT_H - (pts / yMax) * PLOT_H;

  const homePath = stepPath(series.home, scaleX, scaleY);
  const awayPath = stepPath(series.away, scaleX, scaleY);
  // Ribbon paths carry only the horizontal treads: the fade is built
  // from vertically-offset echo strokes, and echoing a vertical riser
  // just re-draws it on top of itself — the smudged build-up you'd
  // otherwise see at every score transition.
  const homeTreads = stepTreadsPath(series.home, scaleX, scaleY);
  const awayTreads = stepTreadsPath(series.away, scaleX, scaleY);

  const isLoading = events.isLoading;
  const hasScoring = series.home.length > 1 || series.away.length > 1;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>Scoring Progression</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Explain Scoring Progression">
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: HOME_FILL }]} />
            <Text style={styles.legendText}>
              {homeTeam.data?.short_name ?? homeTeamId.toUpperCase()}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: AWAY_FILL }]} />
            <Text style={styles.legendText}>
              {awayTeam.data?.short_name ?? awayTeamId.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : !hasScoring ? (
        <Text style={styles.empty}>No scoring events yet.</Text>
      ) : (
        <View
          style={styles.chartFill}
          onLayout={(e) =>
            setCanvas({
              w: Math.round(e.nativeEvent.layout.width),
              h: Math.round(e.nativeEvent.layout.height),
            })
          }>
          {CHART_W > 0 && CHART_H > 0 ? (
        <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          <Defs>
            <ClipPath id="progression-plot-clip">
              <Rect x={0} y={0} width={CHART_W} height={PAD_TOP + PLOT_H} />
            </ClipPath>
          </Defs>

          {/* Contour-hugging fades — a short band beneath each worm
              that follows its steps (GA-style), instead of area fills
              reaching down to the axis. Away first so home's band sits
              on top where the worms run close. */}
          <G clipPath="url(#progression-plot-clip)">
            <LineFadeRibbon path={awayTreads} stroke={AWAY_LINE} />
            <LineFadeRibbon path={homeTreads} stroke={HOME_LINE} />
          </G>

          {/* Y-axis gridlines. Numeric labels dropped so the chart matches
              the minimal-chrome Preview line charts; scale is implicit
              via the header legend + evenly-spaced 10-pt gridlines. */}
          {yTicks.map((t) => (
            <Line
              key={`yg-${t}`}
              x1={PAD_LEFT}
              x2={PAD_LEFT + PLOT_W}
              y1={scaleY(t)}
              y2={scaleY(t)}
              stroke="#F3F4F6"
              strokeWidth={1}
            />
          ))}

          {/* Dashed half-time vertical. Lightened to match the Momentum
              chart's baseline treatment so structural axis lines carry
              the same visual weight across both charts. */}
          <Line
            x1={scaleX(HALF_TIME_MIN)}
            x2={scaleX(HALF_TIME_MIN)}
            y1={PAD_TOP}
            y2={PAD_TOP + PLOT_H}
            stroke="#9CA3AF"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <SvgText
            x={scaleX(HALF_TIME_MIN)}
            y={PAD_TOP - 4}
            fontSize={8}
            fontWeight="700"
            fill={Colors.light.textSecondary}
            textAnchor="middle">
            HT
          </SvgText>

          {/* X-axis labels. Lighter tint and weight so the axis reads
              as a quiet baseline rather than a heavy strip along the
              bottom of the chart. */}
          {xTicks.map((t) => (
            <SvgText
              key={`xl-${t}`}
              x={scaleX(t)}
              y={CHART_H - PAD_BOTTOM + 14}
              fontSize={9}
              fontWeight="500"
              fill="#9CA3AF"
              textAnchor="middle">
              {t === FULL_TIME_MIN ? "80'" : `${t}'`}
            </SvgText>
          ))}

          {/* Team worms — away below, home above so the home line sits on
              top in the frequent case of overlap at low scores. */}
          <Path d={awayPath} fill="none" stroke={AWAY_LINE} strokeWidth={1} strokeLinejoin="round" />
          <Path d={homePath} fill="none" stroke={HOME_LINE} strokeWidth={1} strokeLinejoin="round" />

          {/* Endpoint markers so the eye lands on the final totals. */}
          {homeFinal > 0 ? (
            <Circle cx={scaleX(FULL_TIME_MIN)} cy={scaleY(homeFinal)} r={1.5} fill={HOME_LINE} />
          ) : null}
          {awayFinal > 0 ? (
            <Circle cx={scaleX(FULL_TIME_MIN)} cy={scaleY(awayFinal)} r={1.5} fill={AWAY_LINE} />
          ) : null}
        </Svg>
          ) : null}
        </View>
      )}

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

interface ScorePoint {
  minute: number;
  pts: number;
}

/**
 * Build cumulative point series per team. Every scoring event drives a step
 * — the line stays flat between events. Both series start at (0, 0) so
 * they anchor at the origin, and end at (80, final) so the line always
 * reaches full-time even if the final score came before minute 80.
 */
function buildSeries(
  events: readonly MatchEvent[],
  homeTeamId: string,
  awayTeamId: string,
): { home: ScorePoint[]; away: ScorePoint[] } {
  const scoring = events
    .filter((e) => e.points > 0 && e.team_id !== null)
    .slice()
    .sort(
      (a, b) => (a.minute + a.stoppage / 60) - (b.minute + b.stoppage / 60),
    );

  const home: ScorePoint[] = [{ minute: 0, pts: 0 }];
  const away: ScorePoint[] = [{ minute: 0, pts: 0 }];
  let homeSum = 0;
  let awaySum = 0;
  for (const e of scoring) {
    const t = Math.min(FULL_TIME_MIN, e.minute + e.stoppage / 60);
    if (e.team_id === homeTeamId) {
      homeSum += e.points;
      home.push({ minute: t, pts: homeSum });
    } else if (e.team_id === awayTeamId) {
      awaySum += e.points;
      away.push({ minute: t, pts: awaySum });
    }
  }
  home.push({ minute: FULL_TIME_MIN, pts: homeSum });
  away.push({ minute: FULL_TIME_MIN, pts: awaySum });
  return { home, away };
}

/**
 * Step-line SVG path — horizontal segment at the current cumulative
 * total, vertical jump at each scoring event. Matches the classic
 * broadcast-worm shape (staircase, not smooth curve).
 */
/**
 * The step chart's horizontal treads only, as disconnected subpaths —
 * feeds LineFadeRibbon so the fade hangs beneath each level run without
 * echoing the vertical risers.
 */
function stepTreadsPath(
  points: readonly ScorePoint[],
  scaleX: (minute: number) => number,
  scaleY: (pts: number) => number,
): string {
  const parts: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (curr.minute === prev.minute) continue;
    const y = scaleY(prev.pts).toFixed(1);
    parts.push(
      `M ${scaleX(prev.minute).toFixed(1)} ${y} L ${scaleX(curr.minute).toFixed(1)} ${y}`,
    );
  }
  return parts.join(' ');
}

function stepPath(
  points: readonly ScorePoint[],
  scaleX: (minute: number) => number,
  scaleY: (pts: number) => number,
): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  let d = `M ${scaleX(first.minute).toFixed(1)} ${scaleY(first.pts).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    // Horizontal to the new minute, then vertical to the new score.
    d += ` L ${scaleX(curr.minute).toFixed(1)} ${scaleY(prev.pts).toFixed(1)}`;
    d += ` L ${scaleX(curr.minute).toFixed(1)} ${scaleY(curr.pts).toFixed(1)}`;
  }
  return d;
}


/**
 * Y-axis top = 10 points above the higher final score. Maximises use of
 * the plot area — no wasted headroom rounding up to the next-tens
 * boundary. Floored at 20 so a truly low-scoring / no-scoring match
 * still has a plottable frame.
 */
function niceYMax(top: number): number {
  return Math.max(20, top + 10);
}

/**
 * Y-axis tick positions. Every 10 points from 0 up to (but not past)
 * the highest full multiple-of-10 at or below `yMax` — the top of the
 * axis sits 10 pts above the higher final, so we deliberately skip that
 * partial-slot tick to avoid a cramped label right at the top edge.
 */
function buildYTicks(yMax: number): number[] {
  const out: number[] = [];
  const highest = Math.floor(yMax / 10) * 10;
  for (let v = 0; v <= highest; v += 10) out.push(v);
  return out;
}

// ─── Info modal ──────────────────────────────────────────────────────────────

function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scoring Progression</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Cumulative points over the 80-minute clock, one step-line per
            team. Every try / conversion / penalty / drop-goal drives a
            vertical jump at that minute; the line is otherwise flat.
            The story lives in <Text style={styles.modalStrong}>where the
            worms cross</Text> — the lead-changes and comeback moments of
            the match.
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            The dashed <Text style={styles.modalStrong}>HT</Text> line
            marks half-time. Dots at the right edge show each team's
            full-time total. The dark-grey line is the home team; the
            blue line is the away team — same team-colour convention as
            the Profile radar.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: Spacing.three,
    gap: Spacing.three,
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
    gap: Spacing.two,
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
