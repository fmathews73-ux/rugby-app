import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeam } from '@/api/hooks';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { CountUpValue } from '@/components/insights/count-up-value';
import { useChartInk } from '@/components/insights/use-chart-ink';
import { Colors, Spacing, StatusColor, TextSize, TextTracking } from '@/constants/theme';
import { useTeamAggregate } from '@/hooks/use-team-aggregate';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { CHART_LINE_COLOR } from '@/lib/smooth-path';

const LOOKBACK = 10;

const GOOD_COLOR = '#5CB04E';
const BAD_COLOR = StatusColor.live;
// Volume rows are a style read, not a quality read — neutral fill.
const NEUTRAL_COLOR = '#9CA3AF';

// Tier-1 baselines — mirror the synthetic generator's band; replace
// with live pool averages at real-data cutover (same as the KPI card).
const T1 = {
  contestablesDelivered: 6.5,
  deliveredWonPercent: 43,
  contestablesReceived: 6.5,
  receivedWonPercent: 57,
};

/**
 * Aerial Contest — contestable kicks delivered vs received, volume and
 * won-rate, in the Efficiency KPIs bar grammar (T1 tick, green/red for
 * the quality rows, neutral for the volume rows). The kicking game's
 * missing dimension: when we put it up do we get it back, and when it
 * comes down on us do we keep it?
 */
export function AerialContest({
  teamId,
  style,
}: {
  teamId: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  // Sweep-in driver (shared arrival grammar).
  const ink = useChartInk();
  const team = useTeam(teamId);
  const analysis = useTeamAnalysis(teamId);
  const { data, isLoading } = useTeamAggregate(teamId, undefined, LOOKBACK);
  const g = data?.perGame;

  const rows = g
    ? [
        {
          label: 'Contestables kicked',
          value: String(Math.round(g.contestablesDelivered)),
          suffix: '/g',
          bar: clip(g.contestablesDelivered / 12),
          avg: clip(T1.contestablesDelivered / 12),
          neutral: true,
        },
        {
          label: 'Own kicks regathered',
          value: g.deliveredWonPercent.toFixed(0),
          suffix: '%',
          bar: clip(g.deliveredWonPercent / 100),
          avg: clip(T1.deliveredWonPercent / 100),
        },
        {
          label: 'Contestables received',
          value: String(Math.round(g.contestablesReceived)),
          suffix: '/g',
          bar: clip(g.contestablesReceived / 12),
          avg: clip(T1.contestablesReceived / 12),
          neutral: true,
        },
        {
          label: 'Receptions secured',
          value: g.receivedWonPercent.toFixed(0),
          suffix: '%',
          bar: clip(g.receivedWonPercent / 100),
          avg: clip(T1.receivedWonPercent / 100),
        },
      ]
    : [];

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Aerial"
          onClose={() => setInfoOpen(false)}
          read={analysis.data?.aerial}
          purpose={
            <>
              The kicking duel in the air: contestables the team puts up (and
              wins back) against contestables it fields (and secures). The
              dark tick marks the Tier-1 average on each row. Grey bars are
              volume — a style, not a verdict; the green/red rows are where
              quality is judged.
            </>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
          <View style={styles.headerRow}>
            <CardTitle
              title="Aerial"
            />
            <View style={styles.headerRightGroup}>
              <Pressable
                onPress={() => setInfoOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Explain the aerial contest chart">
                <FlipTrigger />
              </Pressable>
            </View>
          </View>

          {isLoading && !data ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : data && data.gamesPlayed > 0 ? (
            <View style={styles.rowList}>
              {rows.map((r) => (
                <View key={r.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <View style={styles.rowLine}>
                    <View style={styles.track}>
                      <Animated.View
                        style={[
                          styles.fill,
                          {
                            width: `${r.bar * 100}%`,
                            backgroundColor: r.neutral
                              ? NEUTRAL_COLOR
                              : r.bar >= r.avg
                                ? GOOD_COLOR
                                : BAD_COLOR,
                            transformOrigin: 'left',
                            transform: [{ scaleX: ink }],
                          },
                        ]}
                      />
                      <View style={[styles.avgMarker, { left: `${r.avg * 100}%` }]} />
                    </View>
                    <View
                      style={[
                        styles.valueBox,
                        !r.neutral && r.bar >= r.avg ? styles.valueBoxWin : null,
                      ]}>
                      <Text
                        style={[
                          styles.valueText,
                          !r.neutral && r.bar >= r.avg ? styles.valueTextWin : null,
                        ]}>
                        <CountUpValue value={r.value} ink={ink} />
                        <Text
                          style={[
                            styles.suffix,
                            !r.neutral && r.bar >= r.avg ? styles.valueTextWin : null,
                          ]}>
                          {r.suffix}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>No completed matches yet.</Text>
          )}
        </View>
      }
    />
  );
}

function clip(x: number): number {
  return Math.max(0, Math.min(1, x));
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only).
  cardFill: { flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3E8EF',
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
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionLabel: {
    // Chart-card title rule — same as the Home carousel cards.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.md,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: TextTracking.wide,
  },
  empty: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  rowList: { flex: 1, justifyContent: 'space-evenly' },
  row: { gap: 4 },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    fontSize: TextSize.sm,
    color: Colors.light.textSecondary,
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: '#EFF2F6',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  avgMarker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: CHART_LINE_COLOR,
  },
  // Mini score tile in the fixed right rail — the quiet losing-score
  // pairing, matching the Efficiency KPIs card.
  valueBox: {
    width: 44,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#E9EDF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBoxWin: { backgroundColor: Colors.light.textSecondary },
  valueText: {
    // Match-score face — condensed italic at the row-score size.
    fontFamily: 'BarlowCondensed_700Bold_Italic',
    fontSize: TextSize.lg,
    color: Colors.light.textSecondary,
  },
  valueTextWin: { color: Colors.light.textInverse },
  suffix: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
  },
});
