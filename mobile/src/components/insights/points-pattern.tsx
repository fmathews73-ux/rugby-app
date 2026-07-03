import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { useTeam } from '@/api/hooks';
import { Colors, Spacing, StatusColor, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useMatchPointsPattern } from '@/hooks/use-match-points-pattern';
import {
  useTeamPointsPattern,
  type PointsPatternMode,
} from '@/hooks/use-team-points-pattern';
import { TeamToggle, type ToggleSide } from '@/components/insights/team-toggle';

const LABELS: Record<
  PointsPatternMode,
  { title: string; empty: string; a11y: string; color: string }
> = {
  scored: {
    title: 'Scoring Pattern',
    empty: 'No scoring events yet to profile.',
    a11y: 'Explain the Scoring Pattern chart',
    color: '#059669',
  },
  conceded: {
    title: 'Concession Pattern',
    empty: 'No conceded events yet to profile.',
    a11y: 'Explain the Concession Pattern chart',
    color: StatusColor.live,
  },
};

/**
 * "Points Pattern" card — average share of a team's points scored (or
 * conceded) in each 20-minute block (Q1 / Q2 / Q3 / Q4) across their
 * completed matches.
 *
 *   mode 'scored'   → attacking pattern (green bars). Answers "when does
 *                     this team typically score?" — Q4 tall = strong
 *                     finishers.
 *   mode 'conceded' → defensive pattern (red bars). Answers "when does
 *                     this team leak points?" — Q4 tall = tires out late.
 */
export function PointsPattern({
  teamId,
  compareTeamId,
  mode = 'scored',
  fixtureId,
}: {
  teamId: string;
  compareTeamId?: string | null;
  mode?: PointsPatternMode;
  /**
   * When supplied, the card renders the pattern for that single fixture
   * (Q1–Q4 for this match only) instead of averaging across the team's
   * completed matches. Toggle pill still switches primary ↔ compare.
   */
  fixtureId?: string;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSide, setActiveSide] = useState<ToggleSide>('primary');
  const labels = LABELS[mode];
  const isMatchMode = Boolean(fixtureId);

  // Reset toggle back to the primary side whenever the compare team
  // changes — avoids the pill sitting on a stale selection.
  useEffect(() => {
    setActiveSide('primary');
  }, [compareTeamId]);

  const primaryTeam = useTeam(teamId);
  const compareTeam = useTeam(compareTeamId ?? '');

  // Both hooks always called (rules-of-hooks); the one that matches the
  // current mode is used, the other no-ops when its inputs are empty.
  const primaryAggregate = useTeamPointsPattern(isMatchMode ? '' : teamId, mode);
  const compareAggregate = useTeamPointsPattern(
    isMatchMode ? '' : (compareTeamId ?? ''),
    mode,
  );
  const primaryMatch = useMatchPointsPattern(fixtureId ?? '', teamId, mode);
  const compareMatch = useMatchPointsPattern(fixtureId ?? '', compareTeamId ?? '', mode);

  const primaryPattern = isMatchMode ? primaryMatch : primaryAggregate;
  const comparePattern = isMatchMode ? compareMatch : compareAggregate;

  const hasCompare = Boolean(compareTeamId);
  const activePattern = activeSide === 'primary' ? primaryPattern : comparePattern;
  const activeData = activePattern.data;
  const activeLoading = activePattern.isLoading;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.sectionLabel}>{labels.title}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={labels.a11y}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        {hasCompare ? (
          <TeamToggle
            primaryLabel={primaryTeam.data?.short_name ?? teamId.toUpperCase()}
            compareLabel={compareTeam.data?.short_name ?? (compareTeamId ?? '').toUpperCase()}
            activeSide={activeSide}
            onSelect={setActiveSide}
          />
        ) : null}
      </View>
      {/* Sample-size meta on its own row below the title, aggregate mode
          only. Match mode doesn't need this — the sub-tab context makes
          "this match" obvious. */}
      {!isMatchMode && activeData && activeData.gamesUsed > 0 ? (
        <Text style={styles.subHeaderMeta}>
          avg across {activeData.gamesUsed} game{activeData.gamesUsed === 1 ? '' : 's'}
        </Text>
      ) : null}

      {activeLoading && !activeData ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : activeData && activeData.gamesUsed > 0 ? (
        <QuarterBars percents={activeData.avgPercentByQuarter} barColor={labels.color} />
      ) : (
        <Text style={styles.empty}>{labels.empty}</Text>
      )}

      <InfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        mode={mode}
        isMatchMode={isMatchMode}
      />
    </View>
  );
}

/**
 * Four vertical bars — one per quarter. Height proportional to the % share
 * of team's average points scored in that block. Percentages sit above each
 * bar; quarter labels sit below.
 */
function QuarterBars({
  percents,
  barColor,
}: {
  percents: readonly [number, number, number, number];
  barColor: string;
}) {
  const width = 300;
  const height = 140;
  const padTop = 16;
  const padBottom = 20;
  const chartHeight = height - padTop - padBottom;

  // Y-domain: 0..max(50, ceil(max)+5). Reserving a floor of 50 keeps the
  // bars readable when the distribution is even (e.g., 22 / 25 / 27 / 26)
  // — otherwise everything hugs the top.
  const maxPct = Math.max(50, ...percents) + 5;

  const barCount = 4;
  const slotWidth = width / barCount;
  const barWidth = slotWidth * 0.55;
  const labels = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {percents.map((pct, i) => {
        const cx = i * slotWidth + slotWidth / 2;
        const barX = cx - barWidth / 2;
        const barH = (pct / maxPct) * chartHeight;
        const barY = padTop + (chartHeight - barH);
        return (
          <Rect
            key={i}
            x={barX}
            y={barY}
            width={barWidth}
            height={barH}
            rx={3}
            ry={3}
            fill={barColor}
          />
        );
      })}
      {percents.map((pct, i) => {
        const cx = i * slotWidth + slotWidth / 2;
        const barH = (pct / maxPct) * chartHeight;
        const labelY = padTop + (chartHeight - barH) - 4;
        return (
          <SvgText
            key={`p-${i}`}
            x={cx}
            y={labelY}
            fill={Colors.light.text}
            fontSize={11}
            fontWeight="700"
            textAnchor="middle">
            {`${Math.round(pct)}%`}
          </SvgText>
        );
      })}
      {labels.map((label, i) => {
        const cx = i * slotWidth + slotWidth / 2;
        return (
          <SvgText
            key={`x-${i}`}
            x={cx}
            y={height - 4}
            fill={Colors.light.textSecondary}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle">
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function InfoModal({
  visible,
  onClose,
  mode,
  isMatchMode,
}: {
  visible: boolean;
  onClose: () => void;
  mode: PointsPatternMode;
  isMatchMode: boolean;
}) {
  const isScored = mode === 'scored';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{LABELS[mode].title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={Colors.light.text} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Rugby doesn't have formal quarters, but coaches and analysts widely
            use <Text style={styles.modalStrong}>20-minute blocks</Text> (Q1
            0–20, Q2 20–40, Q3 40–60, Q4 60+) to spot game-management patterns.
            {isMatchMode ? (
              <>
                {' '}Each bar shows the{' '}
                <Text style={styles.modalStrong}>
                  {isScored
                    ? "share of this team's points scored in this match"
                    : "share of points conceded by this team in this match"}
                </Text>{' '}
                in that block. Totals across the four bars sum to 100% of the
                team's match points.
              </>
            ) : (
              <>
                {' '}Each bar shows the average{' '}
                <Text style={styles.modalStrong}>
                  {isScored
                    ? "share of this team's own points scored"
                    : "share of points conceded by this team"}
                </Text>{' '}
                in that block, across all their completed matches.
              </>
            )}
          </Text>
          <View style={styles.modalDivider} />
          <Text style={styles.modalBody}>
            {isScored ? (
              <>
                A back-loaded pattern (Q4 tall) reads as a strong-finishing
                team that manages tempo late; a front-loaded one (Q1/Q2 tall)
                reads as a fast starter that fades.
              </>
            ) : (
              <>
                A back-loaded pattern (Q4 tall) suggests the team tires late
                and leaks points at the death; a front-loaded one flags slow
                defensive starts.
              </>
            )}
            {isMatchMode ? null : (
              <>
                {' '}Averaging <Text style={styles.modalStrong}>percentages</Text>{' '}
                (not absolute points) gives every match equal weight — a
                3-point-margin game counts the same as a 40-point blowout.
              </>
            )}
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
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
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
  headerMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  subHeaderMeta: {
    fontSize: TextSize.xs,
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
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
