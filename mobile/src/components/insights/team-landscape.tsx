import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { useTeams, useTeamsFormSummary } from '@/api/hooks';
import { MatrixChart } from '@/components/insights/matrix-chart';
import { FadeCard, NarrativeBack } from '@/components/narrative-flip-card';
import { CardTitle } from '@/components/card-title';
import { FlipTrigger } from '@/components/flip-trigger';
import { Colors, Spacing, TextSize, TextTracking, TextWeight } from '@/constants/theme';
import { useTeamAnalysis } from '@/hooks/use-team-analysis';
import { fitNarrative } from '@/lib/fit-narrative';
import { TIER_1_IDS } from '@/lib/tiers';

/**
 * Team Landscape — the strategy-matrix view of the international pool.
 * Every nation with completed matches is a dot: x = possession share,
 * y = territory share (up = more territory; fed negated because the
 * matrix plots smaller y higher), crosshairs at the pool medians —
 * who controls the BALL against who controls the FIELD (owner call
 * 2026-07-09, replacing the points scored/conceded axes). Four quadrants tell you
 * what kind of side lives where; the subject team is highlighted so
 * the reader sees its neighbourhood, not just its numbers. Data comes
 * from the /teams/form-summary read-model (prev-10 window, one fetch
 * for the whole pool).
 */
export function TeamLandscape({
  teamId,
  compareTeamId,
  style,
}: {
  teamId: string;
  /** Pre-match dual view — highlights both sides on the matrix and
   *  joins both quadrant reads on the back. NOTE: the form-summary
   *  read-model has no as-of param, so on COMPLETED fixtures this
   *  shows current form, not kickoff-frozen form (acceptable drift,
   *  flag if it matters at Phase 6). */
  compareTeamId?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const analysis = useTeamAnalysis(teamId);
  const compareAnalysis = useTeamAnalysis(compareTeamId ?? '');
  const summary = useTeamsFormSummary();
  const teams = useTeams();

  const points = useMemo(() => {
    const codeById = new Map((teams.data ?? []).map((t) => [t.id, t.short_name]));
    return (summary.data ?? [])
      // Tier-scoped pool (owner call 2026-07-09): a side is measured
      // against ITS OWN tier — same philosophy as the tier-average
      // stats — so crosshairs are tier medians, not whole-pool ones.
      .filter(
        (s) =>
          s.games_played > 0 &&
          // Union of both sides' tiers for cross-tier fixtures; the
          // usual single-tier scope when they match (or no compare).
          (TIER_1_IDS.has(s.team_id) === TIER_1_IDS.has(teamId) ||
            (compareTeamId != null &&
              TIER_1_IDS.has(s.team_id) === TIER_1_IDS.has(compareTeamId))),
      )
      .map((s, i, rows) => {
        // Margin per game → 0..1 weight for dot size (outcome as the
        // third axis, matrix convention): a big dot in Starved or a
        // small one among the Controllers is the anomaly worth a look.
        const margins = rows.map(
          (r) => (r.per_game.pointsScored ?? 0) - (r.per_game.pointsConceded ?? 0),
        );
        const minM = Math.min(...margins, 0);
        const span = Math.max(Math.max(...margins, 0) - minM, 1);
        return {
          id: s.team_id,
          code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
          x: s.per_game.possessionPercent ?? s.possession_percent,
          // Negated: the matrix plots smaller y higher, territory is
          // higher-is-better.
          y: -(s.per_game.territoryPercent ?? 0),
          weight: (margins[i]! - minM) / span,
        };
      });
  }, [summary.data, teams.data, teamId, compareTeamId]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Landscape"
          onClose={() => setInfoOpen(false)}
          read={
            compareTeamId
              ? fitNarrative([analysis.data?.landscape, compareAnalysis.data?.landscape], 900)
              : analysis.data?.landscape
          }
          purpose={
            <>Every nation in the team’s tier plotted by possession share against territory share — who controls the ball against who controls the field, from Controllers (both) to Starved (neither). Dot size is the side’s points margin per game.</>
          }
        />
      }
      front={
        <View style={[styles.card, styles.cardFill]}>
      {/* Title left, utility info icon pinned right on the same line. */}
      <View style={styles.headerRow}>
        {/* Radar/2x2 rule: title centred on the chart's vertical axis;
            bar-chart cards keep left titles. */}
        <View style={styles.titleCentreFill} pointerEvents="none">
          <CardTitle title="Landscape" />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the team landscape matrix">
          <FlipTrigger />
        </Pressable>
      </View>

      {summary.isLoading && points.length === 0 ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : points.length < 4 ? (
        <Text style={styles.empty}>Not enough teams with completed matches yet.</Text>
      ) : (
        <MatrixChart
          points={points}
          subjectId={teamId}
          subjectId2={compareTeamId}
          subjectsOnly={Boolean(compareTeamId)}
          xUnit={"%"}
          yUnit={"%"}
          quadrants={{ tr: 'CONTROLLERS', tl: 'KICK-FIRST', br: 'KEEP-BALL', bl: 'STARVED' }}
          xCaption="POSSESSION % →"
          yCaption="TERRITORY % →"
        />
      )}

        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  // Front face fills the flip container (grow-only — natural height
  // stays content-driven).
  cardFill: { flexGrow: 1 },
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
    position: 'relative',
    justifyContent: 'flex-end',
    // Standard air below the title/icon row so charts never creep
    // into the header (with the card gap: 16pt total).
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleCentreFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    // Same card-header treatment as the Teams landing cards.
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
});
