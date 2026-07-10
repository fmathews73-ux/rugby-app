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
import { TIER_1_IDS } from '@/lib/tiers';

/**
 * Defensive Integrity matrix — the game's core defensive relationship:
 * tackle completion is strongly negatively correlated with line breaks
 * conceded, because missed tackles are the proximate cause of breaks.
 * x = tackle success % (right = more complete), y = line breaks
 * conceded per game (up = tighter line; raw value fed directly since
 * the matrix plots smaller y higher). Dot size = points conceded per
 * game (bigger = leakier — the size key says POINTS CONCEDED, not
 * MARGIN). Breaks conceded are DERIVED from opponents' rows
 * (reconciliation principle), never stored independently.
 */
export function DefensiveIntegrity({
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
        // Points conceded per game → 0..1 weight across the TRUE tier
        // range: bigger dot = leakier defence. No zero anchor — unlike
        // margins (which straddle zero), conceded is all-positive, and
        // anchoring at 0 squashed the whole tier into the top of the
        // scale (dots rendered near-identical).
        const conceded = rows.map((r) => r.per_game.pointsConceded ?? 0);
        const minC = Math.min(...conceded);
        const span = Math.max(Math.max(...conceded) - minC, 0.1);
        return {
          id: s.team_id,
          code: codeById.get(s.team_id) ?? s.team_id.toUpperCase(),
          x: s.per_game.tackleSuccessPercent ?? 0,
          y: s.per_game.lineBreaksConceded ?? 0,
          weight: (conceded[i]! - minC) / span,
        };
      });
  }, [summary.data, teams.data, teamId, compareTeamId]);

  return (
    <FadeCard
      style={style}
      flipped={infoOpen}
      back={
        <NarrativeBack
          title="Defence"
          onClose={() => setInfoOpen(false)}
          read={
            // Pair frame: tier-median reads no longer match the chart;
            // About-only until pair-relative narratives exist.
            compareTeamId ? undefined : analysis.data?.defensiveIntegrity
          }
          purpose={
            <>Every nation in the team’s tier over the last 10 plotted by tackle completion against line breaks conceded — missed tackles are the proximate cause of breaks, and completion under ~85% almost always shows on the scoreboard. Dot size is points conceded per game: bigger is leakier.</>
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
          <CardTitle title="Defence" />
        </View>
        <Pressable
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Explain the defensive integrity matrix">
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
          pairCentered={Boolean(compareTeamId)}
          xUnit={"%"}
          quadrants={{ tr: 'THE WALL', tl: 'SCRAMBLERS', br: 'OUT OF SHAPE', bl: 'BROKEN OPEN' }}
          xCaption="TACKLE SUCCESS % →"
          yCaption="FEWER BREAKS CONCEDED →"
          sizeLabel="POINTS CONCEDED"
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
